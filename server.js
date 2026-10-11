// KKTC Hukuk Asistanı — sunucu
// Avukatlar e-posta ve şifreyle girer; abonelik süresi yönetici panelinden verilir.
// Yapay zekâ çağrıları sunucudaki API anahtarıyla yapılır; sorular ve belgeler KAYDEDİLMEZ (yalnızca sayaç tutulur).
//
// Ortam değişkenleri:
//   ANTHROPIC_API_KEY   (zorunlu)  Claude API anahtarı
//   OTURUM_SIRRI        (zorunlu)  oturum çerezlerini imzalamak için uzun rastgele metin
//   YONETICI_EPOSTA     (ilk kurulum) yönetici hesabı; yoksa oluşturulur
//   YONETICI_SIFRE      (ilk kurulum) yönetici şifresi (en az 10 karakter)
//   MODEL               (isteğe bağlı) varsayılan claude-sonnet-5-5
//   GUNLUK_SORU         (isteğe bağlı) kullanıcı başına günlük yapay zekâ isteği, varsayılan 150
//   GUNLUK_KARAKTER     (isteğe bağlı) kullanıcı başına günlük gönderilen metin sınırı (maliyet koruması), varsayılan 5.000.000
//   VERI_KLASORU        (isteğe bağlı) yasa/karar dosyalarının klasörü, varsayılan ./veri
//   DB_YOLU             (isteğe bağlı) SQLite dosyası, varsayılan ./kayit.db (Render'da kalıcı diske koyun)
//   PORT                (Render verir)
'use strict';
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const SIR = process.env.OTURUM_SIRRI || '';
const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const GUNLUK = Number(process.env.GUNLUK_SORU || 150);
const GUNLUK_KAR = Number(process.env.GUNLUK_KARAKTER || 5000000);
const ISTEM_SINIR = 400000;
const VERI = path.resolve(process.env.VERI_KLASORU || path.join(__dirname, 'veri'));
const DB_YOLU = process.env.DB_YOLU || path.join(__dirname, 'kayit.db');
const URETIM = process.env.NODE_ENV === 'production';
if (!SIR || SIR.length < 32) { console.error('OTURUM_SIRRI en az 32 karakter olmalı.'); process.exit(1); }

/* ---------- veritabanı ---------- */
const db = new Database(DB_YOLU);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS kullanici (
  id INTEGER PRIMARY KEY, eposta TEXT UNIQUE NOT NULL, ad TEXT NOT NULL, buro TEXT DEFAULT '',
  sifre TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'avukat', abonelik_bitis TEXT, olusturma TEXT NOT NULL, aktif INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS kullanim (kullanici_id INTEGER NOT NULL, gun TEXT NOT NULL, sayi INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (kullanici_id, gun));
CREATE TABLE IF NOT EXISTS inceleme (id INTEGER PRIMARY KEY, kullanici_id INTEGER NOT NULL, zaman TEXT NOT NULL, veri TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS giris_deneme (anahtar TEXT PRIMARY KEY, sayi INTEGER NOT NULL, ilk INTEGER NOT NULL);
`);
// sonradan eklenen sütunlar (eski veritabanlarında yoksa eklenir)
for (const ek of ["ALTER TABLE kullanici ADD COLUMN surum INTEGER NOT NULL DEFAULT 0", "ALTER TABLE kullanici ADD COLUMN gecici INTEGER NOT NULL DEFAULT 0", "ALTER TABLE kullanim ADD COLUMN karakter INTEGER NOT NULL DEFAULT 0"]) {
  try { db.exec(ek); } catch (_) { /* sütun zaten var */ }
}
const simdi = () => new Date().toISOString();
const bugun = () => new Date().toISOString().slice(0, 10);

if (process.env.YONETICI_EPOSTA && process.env.YONETICI_SIFRE) {
  const e = process.env.YONETICI_EPOSTA.trim().toLowerCase();
  if (!db.prepare('SELECT 1 FROM kullanici WHERE eposta=?').get(e)) {
    if (process.env.YONETICI_SIFRE.length < 10) { console.error('YONETICI_SIFRE en az 10 karakter olmalı.'); process.exit(1); }
    db.prepare("INSERT INTO kullanici (eposta, ad, sifre, rol, abonelik_bitis, olusturma) VALUES (?,?,?,?,?,?)")
      .run(e, 'Yönetici', bcrypt.hashSync(process.env.YONETICI_SIFRE, 12), 'yonetici', '2099-12-31', simdi());
    console.log('Yönetici hesabı oluşturuldu: ' + e);
  }
}

/* ---------- oturum (imzalı çerez) ---------- */
const imza = s => crypto.createHmac('sha256', SIR).update(s).digest('base64url');
// çerez: kullanıcı.sürüm.bitiş.imza — şifre değişince/sıfırlanınca sürüm artar ve tüm eski oturumlar kapanır
function cerezYaz(res, k) {
  const bitis = Date.now() + 1000 * 60 * 60 * 24 * 14;
  const deger = k.id + '.' + (k.surum || 0) + '.' + bitis;
  res.setHeader('Set-Cookie', `oturum=${deger}.${imza(deger)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 24 * 3600}${URETIM ? '; Secure' : ''}`);
}
function oturum(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)oturum=([^;]+)/);
  if (!m) return null;
  const [uid, surum, bitis, sig] = m[1].split('.');
  if (!uid || !surum || !bitis || !sig) return null;
  const beklenen = imza(uid + '.' + surum + '.' + bitis);
  if (sig.length !== beklenen.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(beklenen))) return null;
  if (Date.now() > Number(bitis)) return null;
  const k = db.prepare('SELECT * FROM kullanici WHERE id=? AND aktif=1').get(Number(uid));
  return k && String(k.surum || 0) === surum ? k : null;
}
const abone = k => k && (k.rol === 'yonetici' || (k.abonelik_bitis && k.abonelik_bitis >= bugun()));

/* ---------- uygulama ---------- */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://cdnjs.cloudflare.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
  if (URETIM) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  // durum değiştiren API istekleri yalnızca JSON kabul eder (başka sitelerden form ile istek atılamaz)
  if (req.method === 'POST' && req.path.startsWith('/api/') && !req.is('application/json')) return res.status(415).json({ hata: 'Geçersiz istek biçimi.' });
  next();
});
app.use(require('compression')()); // yasa/karar dosyaları ~4 kat küçülür: daha az bant genişliği, telefonda daha hızlı açılış
app.use(express.json({ limit: '1.5mb' }));
const sayfa = ad => fs.readFileSync(path.join(__dirname, 'sayfalar', ad), 'utf8').replace('/*__CSS__*/', fs.readFileSync(path.join(__dirname, 'sayfalar', 'ortak.css'), 'utf8'));

// giriş denemesi sınırı: aynı e-posta + IP için 15 dakikada 8, aynı IP için 15 dakikada 30 hatalı deneme
function denemeKontrol(anahtar, sinir) {
  const r = db.prepare('SELECT * FROM giris_deneme WHERE anahtar=?').get(anahtar);
  if (r && Date.now() - r.ilk > 15 * 60 * 1000) { db.prepare('DELETE FROM giris_deneme WHERE anahtar=?').run(anahtar); return true; }
  return !r || r.sayi < (sinir || 8);
}
const SAHTE_OZET = bcrypt.hashSync('kullanici-yok-' + crypto.randomBytes(8).toString('hex'), 12); // olmayan e-postada da aynı süre beklensin
function denemeEkle(anahtar) {
  db.prepare('INSERT INTO giris_deneme (anahtar, sayi, ilk) VALUES (?,1,?) ON CONFLICT(anahtar) DO UPDATE SET sayi=sayi+1').run(anahtar, Date.now());
}

app.get('/giris', (req, res) => res.type('html').send(sayfa('giris.html')));
app.get('/kosullar', (req, res) => res.type('html').send(sayfa('kosullar.html')));
app.post('/api/giris', (req, res) => {
  const e = String(req.body.eposta || '').trim().toLowerCase(), s = String(req.body.sifre || '');
  // sınırlar: e-posta+IP 8, IP 30, e-posta (tüm IP'lerden) 40 hatalı deneme / 15 dakika
  const anahtar = e + '|' + req.ip, ipAnahtar = 'ip|' + req.ip, epAnahtar = 'e|' + e;
  if (!denemeKontrol(anahtar) || !denemeKontrol(ipAnahtar, 30) || !denemeKontrol(epAnahtar, 40)) return res.status(429).json({ hata: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' });
  const k = db.prepare('SELECT * FROM kullanici WHERE eposta=? AND aktif=1').get(e);
  const dogru = bcrypt.compareSync(s, k ? k.sifre : SAHTE_OZET);
  if (!k || !dogru) { denemeEkle(anahtar); denemeEkle(ipAnahtar); denemeEkle(epAnahtar); return res.status(401).json({ hata: 'E-posta veya şifre hatalı.' }); }
  db.prepare('DELETE FROM giris_deneme WHERE anahtar=?').run(anahtar);
  cerezYaz(res, k);
  res.json({ ok: true, yonetici: k.rol === 'yonetici', gecici: !!k.gecici });
});
app.post('/api/cikis', (req, res) => { res.setHeader('Set-Cookie', `oturum=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${URETIM ? '; Secure' : ''}`); res.json({ ok: true }); });
app.post('/api/sifre', (req, res) => {
  const k = oturum(req); if (!k) return res.status(401).json({ hata: 'Oturum yok.' });
  const eski = String(req.body.eski || ''), yeni = String(req.body.yeni || '');
  if (!bcrypt.compareSync(eski, k.sifre)) return res.status(400).json({ hata: 'Mevcut şifre hatalı.' });
  if (yeni.length < 10) return res.status(400).json({ hata: 'Yeni şifre en az 10 karakter olmalı.' });
  if (yeni === eski) return res.status(400).json({ hata: 'Yeni şifre eskisiyle aynı olamaz.' });
  db.prepare('UPDATE kullanici SET sifre=?, surum=surum+1, gecici=0 WHERE id=?').run(bcrypt.hashSync(yeni, 12), k.id);
  cerezYaz(res, db.prepare('SELECT * FROM kullanici WHERE id=?').get(k.id)); // bu cihaz açık kalır, diğer oturumlar kapanır
  res.json({ ok: true });
});

// bundan sonrası oturum ister
function girisGerekli(req, res, next) {
  const k = oturum(req);
  if (!k) return req.path.startsWith('/api/') ? res.status(401).json({ hata: 'Oturum açın.', kod: 'not_granted' }) : res.redirect('/giris');
  req.k = k; next();
}
app.use(girisGerekli);

app.get('/api/ben', (req, res) => {
  const k = req.k, u = db.prepare('SELECT sayi, karakter FROM kullanim WHERE kullanici_id=? AND gun=?').get(k.id, bugun());
  res.json({ id: String(k.id), ad: k.ad, eposta: k.eposta, buro: k.buro, rol: k.rol, abonelik_bitis: k.abonelik_bitis, abone: abone(k), gecici: !!k.gecici,
    bugun_kullanim: u ? u.sayi : 0, gunluk_sinir: GUNLUK, bugun_karakter: u ? u.karakter : 0, gunluk_karakter: GUNLUK_KAR });
});

// yapay zekâ: sayfanın hazırladığı istemi Claude'a iletir. İçerik kaydedilmez.
app.post('/api/sor', async (req, res) => {
  const k = req.k;
  if (!abone(k)) return res.status(403).json({ hata: 'Aboneliğiniz sona ermiş. Yenilemek için bizimle iletişime geçin.', kod: 'not_granted' });
  if (!API_KEY) return res.status(503).json({ hata: 'Yapay zekâ henüz yapılandırılmadı.', kod: 'sampling_disabled' });
  const istem = req.body && req.body.istem;
  if (typeof istem !== 'string' || istem.length < 10) return res.status(400).json({ hata: 'Geçersiz istek.' });
  if (istem.length > ISTEM_SINIR) return res.status(413).json({ hata: 'Metin çok uzun.', kod: 'prompt_too_large' });
  const u = db.prepare('SELECT sayi, karakter FROM kullanim WHERE kullanici_id=? AND gun=?').get(k.id, bugun());
  if (k.rol !== 'yonetici' && u && u.sayi >= GUNLUK) return res.status(429).json({ hata: 'Günlük kullanım sınırına ulaştınız.', kod: 'rate_limited' });
  if (k.rol !== 'yonetici' && u && u.karakter + istem.length > GUNLUK_KAR) return res.status(429).json({ hata: 'Günlük metin sınırına ulaştınız (çok uzun belgeler). Yarın tekrar deneyin.', kod: 'rate_limited' });
  db.prepare('INSERT INTO kullanim (kullanici_id, gun, sayi, karakter) VALUES (?,?,1,?) ON CONFLICT(kullanici_id, gun) DO UPDATE SET sayi=sayi+1, karakter=karakter+excluded.karakter').run(k.id, bugun(), istem.length);
  const ac = new AbortController(); res.on('close', () => { if (!res.writableEnded) ac.abort(); });
  // yapay zekâ cevap veremezse kullanım sayacı geri alınır (avukatın hakkı yanmasın)
  const iade = () => db.prepare('UPDATE kullanim SET sayi=MAX(0,sayi-1), karakter=MAX(0,karakter-?) WHERE kullanici_id=? AND gun=?').run(istem.length, k.id, bugun());
  try {
    const r = await fetch(process.env.ANTHROPIC_URL || 'https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ac.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: 'user', content: istem }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      iade();
      console.error('Claude API hatası', r.status, j && j.error && j.error.type);
      return res.status(r.status === 429 ? 429 : 502).json({ hata: 'Yapay zekâ şu anda cevap veremedi.', kod: r.status === 429 ? 'rate_limited' : 'upstream' });
    }
    const metin = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    res.json({ metin });
  } catch (e) {
    iade();
    if (ac.signal.aborted) return;
    console.error('Claude API bağlantı hatası', e.message);
    res.status(502).json({ hata: 'Yapay zekâya bağlanılamadı.', kod: 'upstream' });
  }
});

// avukat incelemeleri (ortak kayıt; büro içi değerlendirme)
app.get('/api/inceleme', (req, res) => {
  // avukatlar yalnızca kendi incelemelerini görür (bürolar arası gizlilik); yönetici hepsini görür
  const hepsi = req.k.rol === 'yonetici';
  const rows = db.prepare('SELECT i.id, i.kullanici_id, i.zaman, i.veri, k.ad FROM inceleme i JOIN kullanici k ON k.id=i.kullanici_id' + (hepsi ? '' : ' WHERE i.kullanici_id=?') + ' ORDER BY i.zaman DESC LIMIT 1000').all(...(hepsi ? [] : [req.k.id]));
  res.json(rows.map(r => ({ id: String(r.id), ...JSON.parse(r.veri), kim: String(r.kullanici_id), kim_ad: r.ad, zaman: r.zaman })));
});
app.post('/api/inceleme', (req, res) => {
  const v = req.body || {};
  const temiz = {};
  for (const a of ['hedef', 'tur', 'etiket', 'karar', 'not', 'soru', 'cevap', 'kaynaklar', 'metin']) if (v[a] !== undefined) temiz[a] = typeof v[a] === 'string' ? v[a].slice(0, 20000) : v[a];
  if (!temiz.hedef || !['dogru', 'duzelt', 'eksik'].includes(temiz.karar)) return res.status(400).json({ hata: 'Eksik bilgi.' });
  if (JSON.stringify(temiz).length > 60000) return res.status(413).json({ hata: 'Kayıt çok uzun.' });
  db.prepare('INSERT INTO inceleme (kullanici_id, zaman, veri) VALUES (?,?,?)').run(req.k.id, simdi(), JSON.stringify(temiz));
  res.json({ ok: true });
});

// yönetici
function yonetici(req, res, next) { if (req.k.rol !== 'yonetici') return res.status(403).json({ hata: 'Yetki yok.' }); next(); }
app.get('/hesap', (req, res) => res.type('html').send(sayfa('hesap.html')));
app.get('/yonetim', yonetici, (req, res) => res.type('html').send(sayfa('yonetim.html')));
app.get('/api/yonetim/kullanicilar', yonetici, (req, res) => {
  const rows = db.prepare(`SELECT k.id, k.eposta, k.ad, k.buro, k.rol, k.abonelik_bitis, k.aktif, k.olusturma,
    (SELECT COALESCE(SUM(sayi),0) FROM kullanim WHERE kullanici_id=k.id AND gun>=date('now','-30 day')) AS son30
    FROM kullanici k ORDER BY k.olusturma DESC`).all();
  res.json(rows);
});
app.post('/api/yonetim/kullanici', yonetici, (req, res) => {
  const e = String(req.body.eposta || '').trim().toLowerCase(), ad = String(req.body.ad || '').trim(), buro = String(req.body.buro || '').trim();
  const bitis = String(req.body.abonelik_bitis || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || !ad || !/^\d{4}-\d{2}-\d{2}$/.test(bitis)) return res.status(400).json({ hata: 'E-posta, ad ve abonelik bitiş tarihi gerekli.' });
  if (db.prepare('SELECT 1 FROM kullanici WHERE eposta=?').get(e)) return res.status(400).json({ hata: 'Bu e-posta zaten kayıtlı.' });
  const gecici = crypto.randomBytes(9).toString('base64url');
  db.prepare('INSERT INTO kullanici (eposta, ad, buro, sifre, abonelik_bitis, olusturma, gecici) VALUES (?,?,?,?,?,?,1)').run(e, ad.slice(0, 120), buro.slice(0, 160), bcrypt.hashSync(gecici, 12), bitis, simdi());
  res.json({ ok: true, gecici_sifre: gecici });
});
app.post('/api/yonetim/guncelle', yonetici, (req, res) => {
  const id = Number(req.body.id), k = db.prepare('SELECT * FROM kullanici WHERE id=?').get(id);
  if (!k) return res.status(404).json({ hata: 'Kullanıcı yok.' });
  if (req.body.abonelik_bitis && /^\d{4}-\d{2}-\d{2}$/.test(req.body.abonelik_bitis)) db.prepare('UPDATE kullanici SET abonelik_bitis=? WHERE id=?').run(req.body.abonelik_bitis, id);
  if (req.body.aktif !== undefined && k.rol !== 'yonetici') db.prepare('UPDATE kullanici SET aktif=?, surum=surum+1 WHERE id=?').run(req.body.aktif ? 1 : 0, id);
  let gecici;
  if (req.body.sifre_sifirla) { gecici = crypto.randomBytes(9).toString('base64url'); db.prepare('UPDATE kullanici SET sifre=?, surum=surum+1, gecici=1 WHERE id=?').run(bcrypt.hashSync(gecici, 12), id); }
  res.json({ ok: true, gecici_sifre: gecici });
});

// uygulama sayfası: claude.ai köprüsü eklenmiş hâliyle
let ANA = null;
function anaSayfa() {
  if (ANA && !process.env.GELISTIRME) return ANA;
  const html = fs.readFileSync(path.join(VERI, 'kira_asistani.html'), 'utf8');
  const bas = '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex">' +
    '<style>:root{color-scheme:light dark}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style><script src="/kopru.js"></script></head><body>';
  ANA = bas + html + '</body></html>';
  return ANA;
}
app.get('/', (req, res) => res.type('html').send(anaSayfa()));
app.get('/kopru.js', (req, res) => res.type('js').sendFile(path.join(__dirname, 'sayfalar', 'kopru.js')));
app.use(express.static(VERI, { index: false, maxAge: '1d', setHeaders: r => r.setHeader('Cache-Control', 'private, max-age=86400') }));

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log('KKTC Hukuk Asistanı çalışıyor: ' + PORT + ' · model ' + MODEL + (API_KEY ? '' : ' · UYARI: ANTHROPIC_API_KEY yok')));
