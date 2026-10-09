// KKTC Yüksek Mahkeme mevzuat sistemi (mevzuat.mahkemeler.net) — birleştirilmiş yasalar, tüzükler, kararlar.
// Kullanım:
//   node scripts/mahkemeler.js liste              → üç listeyi günceller; kararların metnini de kaydeder
//   node scripts/mahkemeler.js indir yasa [adet]   → birleştirilmiş yasa dosyalarını indirip metne çevirir
//   node scripts/mahkemeler.js indir tuzuk [adet]  → tüzük dosyalarını indirip metne çevirir
// Site herkese açıktır; misafir oturumu açmak için önce ana sayfa ziyaret edilir. İstekler arası 2 sn beklenir.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { UA, BEKLE_MS, uyu, sha256, metinCikar } = require('./ortak');

const SITE = process.env.MAHKEME_SITE || 'https://mevzuat.mahkemeler.net';
const cerez = new Map();

function cerezAl(r) {
  const liste = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
  for (const c of liste) { const [kv] = c.split(';'); const i = kv.indexOf('='); if (i > 0) cerez.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); }
}
const cerezBaslik = () => [...cerez].map(([k, v]) => k + '=' + v).join('; ');

async function istek(url, secenek = {}, deneme = 3) {
  let son;
  for (let i = 1; i <= deneme; i++) {
    try {
      let u = url, r;
      for (let y = 0; y < 6; y++) { // yönlendirmeleri elle izle ki çerezler kaybolmasın
        r = await fetch(u, { ...secenek, redirect: 'manual', signal: AbortSignal.timeout(90000),
          headers: { 'User-Agent': UA, ...(cerez.size ? { Cookie: cerezBaslik() } : {}), ...(secenek.headers || {}) } });
        cerezAl(r);
        const loc = r.headers.get('location');
        if (r.status >= 300 && r.status < 400 && loc) { u = new URL(loc, u).toString(); secenek = { method: 'GET' }; continue; }
        break;
      }
      return r;
    } catch (e) { son = e; if (i < deneme) await uyu(BEKLE_MS * i * 2); }
  }
  throw son;
}

async function oturumAc() {
  const r = await istek(SITE + '/web/index?BackLink=YasaArama');
  await r.arrayBuffer();
  await uyu(BEKLE_MS);
}

const KAYNAKLAR = {
  yasa: { yol: '/MEVZUAT/Yasa/LoadDataForGrid', sirala: 'Numara',
    ek: { NeyeGore: 'arama', Numara: '', YasaAd: '', YasaMetin: '', YasaTurPkey: '0' } },
  tuzuk: { yol: '/MEVZUAT/Enstruman/LoadDataForGrid', sirala: 'AmmeEnstrumanNo',
    ek: { NeyeGore: 'arama', TurPkey: '', UstSayi: '', AltSayi: '', Ad: '', Yasa: '', AmmeEnstrumanNo: '', AmmeEnstrumanTur: '' } },
  karar: { yol: '/MEVZUAT/Karar/LoadDataForGrid', sirala: 'Tarih',
    ek: { NeyeGore: 'arama', AnaTurPkey: '', TurPkey: '', Yild: '', Yile: '', Dnumara: '', Enumara: '', Taraflar: '', Konu: '', YasaMadde: '', Ozet: '', KararMetin: '', Siralama: 'Karar Tarihine Göre Eskiden Yeniye' } },
};

async function sayfa(tur, start, length) {
  const k = KAYNAKLAR[tur];
  const p = new URLSearchParams({ draw: '1', start: String(start), length: String(length),
    'columns[0][data]': 'Pkey', 'columns[0][name]': 'Pkey', 'columns[1][data]': k.sirala, 'columns[1][name]': k.sirala,
    'order[0][column]': '0', 'order[0][dir]': 'asc', 'search[value]': '', 'search[regex]': 'false', ...k.ek });
  const r = await istek(SITE + k.yol, { method: 'POST', body: p.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' } });
  const t = await r.text();
  if (!t.trim().startsWith('{')) throw new Error(tur + ' listesi JSON değil (HTTP ' + r.status + '): ' + t.slice(0, 120));
  return JSON.parse(t);
}

const temizAd = s => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80);
const bagla = link => link ? SITE + link.replace(/\?rnd=\d+$/, '') : null;

async function liste() {
  await oturumAc();
  fs.mkdirSync('liste', { recursive: true });
  const KDIR = 'veri/mahkemeler/kararlar';
  fs.mkdirSync(KDIR, { recursive: true });
  const ozet = {};
  const SIRALAMALAR = ['Karar Tarihine Göre Eskiden Yeniye', 'Karar Tarihine Göre Yeniden Eskiye',
    'Dağıtım Numarasına Göre Eskiden Yeniye', 'Dağıtım Numarasına Göre Yeniden Eskiye'];
  for (const tur of ['yasa', 'tuzuk', 'karar']) {
    const harita = new Map(); let toplam = Infinity;
    // Sayfalama sırası sabit olmayabilir: eksik kalırsa farklı sıralamayla tekrar geçip tamamlarız.
    for (let gecis = 0; gecis < (tur === 'karar' ? SIRALAMALAR.length : 2) && harita.size < toplam; gecis++) {
      if (tur === 'karar') KAYNAKLAR.karar.ek.Siralama = SIRALAMALAR[gecis];
      for (let start = 0; start < toplam; start += 100) {
        const j = await sayfa(tur, start, 100);
        toplam = j.recordsTotal;
        for (const s of j.data) {
          if (harita.has(s.Pkey)) continue;
          const metin = s.KararMetin || '';
          const kayit = { ...s };
          delete kayit.KararMetin; delete kayit.YasaMetin; delete kayit.KullaniciPkey;
          kayit.url = bagla(s.DownloadLink);
          if (tur === 'karar' && metin.trim().length > 200) {
            const ad = s.Pkey + '.txt';
            fs.writeFileSync(path.join(KDIR, ad), metin);
            kayit.metin_dosyasi = KDIR + '/' + ad; kayit.metin_sha256 = sha256(Buffer.from(metin)); kayit.karakter = metin.length;
          }
          harita.set(s.Pkey, kayit);
        }
        console.log(tur + ' (geçiş ' + (gecis + 1) + '): ' + Math.min(start + 100, toplam) + ' / ' + toplam + ' — benzersiz ' + harita.size);
        await uyu(BEKLE_MS);
      }
    }
    if (harita.size < toplam) console.log('UYARI: ' + tur + ' listesinde ' + (toplam - harita.size) + ' kayıt alınamadı');
    const satirlar = [...harita.values()];
    const dosya = 'liste/mahkemeler-' + tur + '.json';
    fs.writeFileSync(dosya, JSON.stringify({ kaynak: SITE, alindi: new Date().toISOString(), toplam: satirlar.length, kayitlar: satirlar }, null, 0));
    ozet[tur] = satirlar.length;
  }
  ozet.karar_metni_olan = fs.readdirSync(KDIR).length;
  console.log('\nListe tamam: ' + JSON.stringify(ozet));
}

async function indir(tur, enFazla, secili) {
  let L = JSON.parse(fs.readFileSync('liste/mahkemeler-' + tur + '.json', 'utf8')).kayitlar;
  if (secili) L = L.filter(s => secili.includes(String(s.Pkey)));
  // seçili indirmeler ayrı kayda yazılır; büyük işle aynı dosyaya yazıp çakışmasın
  const KAYIT = 'veri/mahkemeler/' + (secili ? 'secili-' : '') + tur + '-kayit.json';
  const MDIR = 'veri/mahkemeler/' + (secili ? 'secili/' : '') + (tur === 'yasa' ? 'yasalar' : 'tuzukler');
  // orijinaller depoya konmaz (çok büyük); parmak izi saklanır. HAM_DIR verilirse orijinaller oraya da yazılır
  // (iş akışı bunları depoya değil, GitHub Actions 'artifact' olarak geçici saklar).
  const HAM = process.env.HAM_DIR || path.join(os.tmpdir(), 'ham');
  fs.mkdirSync(MDIR, { recursive: true }); fs.mkdirSync(HAM, { recursive: true });
  const kayit = fs.existsSync(KAYIT) ? JSON.parse(fs.readFileSync(KAYIT, 'utf8')) : {};
  const sec = L.filter(s => s.url && !(kayit[s.Pkey] && kayit[s.Pkey].durum === 'tamam')).slice(0, enFazla);
  console.log(sec.length + ' ' + tur + ' işlenecek');
  await oturumAc();
  const t0 = Date.now(); let tamam = 0, sorun = 0;
  for (const s of sec) {
    if (Date.now() - t0 > 5 * 60 * 60 * 1000) break;
    const k = { pkey: s.Pkey, numara: s.Numara || s.AmmeEnstrumanNo, ad: (s.YasaAd || s.Ad || '').trim(), url: s.url, alindi: new Date().toISOString() };
    try {
      const r = await istek(s.url);
      const buf = Buffer.from(await r.arrayBuffer());
      k.http = r.status;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      k.bayt = buf.length; k.sha256 = sha256(buf);
      if (process.env.HAM_DIR) fs.writeFileSync(path.join(HAM, s.Pkey + '_' + temizAd(s.DosyaAd)), buf);
      const m = await metinCikar(buf, s.DosyaAd || '');
      const ad = s.Pkey + '_' + temizAd(s.DosyaAd) + '.txt';
      fs.writeFileSync(path.join(MDIR, ad), m.metin);
      Object.assign(k, { bicim: m.bicim, karakter: m.metin.length, metin_dosyasi: MDIR + '/' + ad,
        birlestirilmis: /değiştirilmiş|birleştirilmiş|Değişiklik Yasalarıyla/i.test(m.metin.slice(0, 3000)) });
      k.durum = m.metin.trim().length < 200 ? 'metin-cok-kisa' : 'tamam';
    } catch (e) { k.durum = 'sorun'; k.hata = String(e.message || e); }
    kayit[s.Pkey] = k;
    if (k.durum === 'tamam') tamam++; else sorun++;
    console.log((k.durum === 'tamam' ? '✓ ' : '✗ ') + k.numara + ' ' + k.ad.slice(0, 60) + (k.hata ? ' — ' + k.hata : ''));
    if ((tamam + sorun) % 25 === 0) fs.writeFileSync(KAYIT, JSON.stringify(kayit, null, 1));
    await uyu(BEKLE_MS);
  }
  fs.writeFileSync(KAYIT, JSON.stringify(kayit, null, 1));
  console.log('\n' + tur + ': bu çalıştırmada ' + tamam + ' tamam, ' + sorun + ' sorunlu');
}

module.exports = { oturumAc, sayfa, istek, SITE };

if (require.main === module) {
  const [komut, tur, adet] = process.argv.slice(2);
  (komut === 'liste' ? liste() : komut === 'indir' ? indir(tur, Number(adet || 1500)) : komut === 'secili' ? indir(tur, 100, String(adet || '').split(',').map(x => x.trim()).filter(Boolean)) : Promise.reject(new Error('komut: liste | indir yasa|tuzuk')))
    .catch(e => { console.error('HATA: ' + (e.message || e)); process.exit(1); });
}
