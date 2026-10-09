// 2. adım: listedeki belgeleri yavaşça indirir, metnini çıkarır, kaydeder.
// Kullanım: node scripts/cek.js <dalga: 1 | 2 | 0 | hepsi> [en fazla belge sayısı]
// Daha önce başarıyla alınmış belgeleri tekrar indirmez (kaldığı yerden devam eder).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { BEKLE_MS, uyu, sha256, dosyaUrl, indir, metinCikar } = require('./ortak');

const dalga = process.argv[2] || '1';
const enFazla = Number(process.argv[3] || 400);
const SURE_SINIRI_MS = 5 * 60 * 60 * 1000; // GitHub işi 6 saatte kesilir; 5 saatte dur, kaydet.

const liste = JSON.parse(fs.readFileSync('liste/tum-yasalar.json', 'utf8')).belgeler;
const KAYIT = 'veri/kayit.json';
const HAM = path.join(os.tmpdir(), 'meclis-ham'); // orijinaller depoya konmaz (çok büyük); parmak izi kayıtta
fs.mkdirSync(HAM, { recursive: true });
fs.mkdirSync('veri/metin', { recursive: true });
const kayit = fs.existsSync(KAYIT) ? JSON.parse(fs.readFileSync(KAYIT, 'utf8')) : {};

const guvenliAd = d => d.replace(/[\\/:*?"<>|]+/g, '_');
const kaydet = () => fs.writeFileSync(KAYIT, JSON.stringify(kayit, null, 1));

(async () => {
  const t0 = Date.now();
  const secilen = liste.filter(b => dalga === 'hepsi' || String(b.dalga) === dalga)
    .filter(b => !(kayit[b.dosya] && kayit[b.dosya].durum === 'tamam'))
    .slice(0, enFazla);
  console.log(secilen.length + ' belge işlenecek (dalga ' + dalga + ')');
  let tamam = 0, hata = 0;
  for (const b of secilen) {
    if (Date.now() - t0 > SURE_SINIRI_MS) { console.log('Süre sınırı: kalan belgeler bir sonraki çalıştırmada.'); break; }
    const url = dosyaUrl(b.dosya);
    const r = await indir(url);
    const k = { baslik: b.baslik, tur: b.tur, sayi: b.sayi, dalga: b.dalga, url, alindi: new Date().toISOString(), http: r.durum };
    if (!r.ok) {
      k.durum = 'indirilemedi'; k.hata = r.hata || ('HTTP ' + r.durum); hata++;
    } else {
      k.bayt = r.bayt; k.sha256 = sha256(r.buf);
      const ad = guvenliAd(b.dosya);
      fs.writeFileSync(path.join(HAM, ad), r.buf);
      try {
        const m = await metinCikar(r.buf, b.dosya);
        k.bicim = m.bicim; k.karakter = m.metin.length; if (m.sayfa) k.pdf_sayfa = m.sayfa;
        fs.writeFileSync(path.join('veri/metin', ad + '.txt'), m.metin);
        k.metin_dosyasi = 'veri/metin/' + ad + '.txt';
        k.durum = m.metin.trim().length < 200 ? 'metin-cok-kisa' : 'tamam';
        if (k.durum === 'tamam') tamam++; else hata++;
      } catch (e) { k.durum = 'metin-cikarilamadi'; k.hata = String(e.message || e); hata++; }
    }
    kayit[b.dosya] = k;
    console.log((k.durum === 'tamam' ? '✓ ' : '✗ ') + b.sayi + ' ' + b.baslik.slice(0, 60) + ' — ' + k.durum + (k.hata ? ' (' + k.hata + ')' : ''));
    if ((tamam + hata) % 20 === 0) kaydet();
    await uyu(BEKLE_MS);
  }
  kaydet();
  const ozet = Object.values(kayit).reduce((o, k) => (o[k.durum] = (o[k.durum] || 0) + 1, o), {});
  fs.writeFileSync('veri/ozet.json', JSON.stringify({ guncellendi: new Date().toISOString(), toplam_liste: liste.length, durumlar: ozet }, null, 1));
  console.log('\nBu çalıştırma: ' + tamam + ' tamam, ' + hata + ' sorunlu. Genel durum: ' + JSON.stringify(ozet));
})();
