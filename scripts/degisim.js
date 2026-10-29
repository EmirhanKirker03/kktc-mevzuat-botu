// Mahkemeler sitesindeki birleştirilmiş yasa/tüzük dosyalarının değişip değişmediğini denetler.
// Site, bir yasa değiştirildiğinde aynı adresteki dosyayı yenisiyle değiştirir; normal indirme ("indir") bir kez
// alınmış dosyayı tekrar almadığı için bu değişiklikler kaçar. Bu betik her dosyayı yeniden indirir, SHA-256 parmak
// izini önceki kayıtla karşılaştırır ve yalnızca DEĞİŞEN dosyaların metnini yeniler:
//   - ham metin (…-kayit.json + yasalar/ ya da tuzukler/) yenilenir, eski parmak izi "onceki_sha256" olarak saklanır,
//   - LibreOffice metni (…-lo-kayit.json) silinir → ardından "node scripts/onarim.js lo <tur>" yalnızca bunları yeniden çıkarır,
//   - taranmış (OCR) dosya değiştiyse eski OCR kaydı silinir → iş akışı 5 (ocr) yeniden okur.
// Rapor: sonuc/degisim-<tur>.json (değişen, yeni, hata listeleri). Metinler değiştirilmez; yalnızca kaynaktan yeniden alınır.
// Kullanım: node scripts/degisim.js yasa|tuzuk
const fs = require('fs');
const path = require('path');
const { BEKLE_MS, uyu, sha256, metinCikar } = require('./ortak');
const { oturumAc, istek } = require('./mahkemeler');

const oku = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const yaz = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };
const temizAd = s => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80);

async function denetle(tur) {
  const L = oku('liste/mahkemeler-' + tur + '.json').kayitlar.filter(s => s.url);
  const KAYIT = 'veri/mahkemeler/' + tur + '-kayit.json';
  const LKAYIT = 'veri/mahkemeler/' + tur + '-lo-kayit.json';
  const ODIR = 'veri/mahkemeler/' + (tur === 'yasa' ? 'ocr-kayit' : 'ocr-tuzuk-kayit');
  const MDIR = 'veri/mahkemeler/' + (tur === 'yasa' ? 'yasalar' : 'tuzukler');
  const kayit = oku(KAYIT);
  const lk = fs.existsSync(LKAYIT) ? oku(LKAYIT) : {};
  const ocrDosyalar = fs.existsSync(ODIR) ? fs.readdirSync(ODIR).filter(f => f.endsWith('.json')).map(f => path.join(ODIR, f)) : [];
  const rapor = { tur, basladi: new Date().toISOString(), denetlenen: 0, ayni: 0, degisen: [], yeni: [], hata: [] };
  fs.mkdirSync(MDIR, { recursive: true });
  await oturumAc();
  const t0 = Date.now();
  for (const s of L) {
    if (Date.now() - t0 > 5.2 * 3600 * 1000) { rapor.yarim_kaldi = true; break; }
    const pk = String(s.Pkey); const onceki = kayit[pk];
    try {
      const r = await istek(s.url);
      const buf = Buffer.from(await r.arrayBuffer());
      if (!r.ok) throw new Error('HTTP ' + r.status);
      rapor.denetlenen++;
      const h = sha256(buf);
      if (onceki && onceki.sha256 === h) { rapor.ayni++; await uyu(BEKLE_MS); continue; }
      const k = { pkey: s.Pkey, numara: s.Numara || s.AmmeEnstrumanNo, ad: (s.YasaAd || s.Ad || '').trim(), url: s.url,
                  alindi: new Date().toISOString(), http: r.status, bayt: buf.length, sha256: h };
      if (onceki && onceki.sha256) k.onceki_sha256 = onceki.sha256;
      const m = await metinCikar(buf, s.DosyaAd || '');
      const ad = s.Pkey + '_' + temizAd(s.DosyaAd) + '.txt';
      fs.writeFileSync(path.join(MDIR, ad), m.metin);
      Object.assign(k, { bicim: m.bicim, karakter: m.metin.length, metin_dosyasi: MDIR + '/' + ad,
        birlestirilmis: /değiştirilmiş|birleştirilmiş|Değişiklik Yasalarıyla/i.test(m.metin.slice(0, 3000)) });
      k.durum = m.metin.trim().length < 200 ? 'metin-cok-kisa' : 'tamam';
      kayit[pk] = k;
      delete lk[pk];
      for (const f of ocrDosyalar) { const o = oku(f); if (o[pk]) { delete o[pk]; yaz(f, o); } }
      (onceki ? rapor.degisen : rapor.yeni).push({ pkey: s.Pkey, numara: k.numara, ad: k.ad.slice(0, 120), durum: k.durum });
      console.log((onceki ? 'DEĞİŞTİ ' : 'YENİ ') + k.numara + ' ' + k.ad.slice(0, 60));
    } catch (e) {
      rapor.hata.push({ pkey: s.Pkey, hata: String(e.message || e).slice(0, 200) });
    }
    if (rapor.denetlenen % 50 === 0) { yaz(KAYIT, kayit); yaz(LKAYIT, lk); }
    await uyu(BEKLE_MS);
  }
  yaz(KAYIT, kayit); yaz(LKAYIT, lk);
  rapor.bitti = new Date().toISOString();
  yaz('sonuc/degisim-' + tur + '.json', rapor);
  console.log(`\n${tur}: denetlenen ${rapor.denetlenen}, aynı ${rapor.ayni}, değişen ${rapor.degisen.length}, yeni ${rapor.yeni.length}, hata ${rapor.hata.length}`);
}

if (require.main === module) {
  const tur = process.argv[2];
  if (!['yasa', 'tuzuk'].includes(tur)) { console.error('kullanım: node scripts/degisim.js yasa|tuzuk'); process.exit(1); }
  denetle(tur).catch(e => { console.error('HATA: ' + (e.message || e)); process.exit(1); });
}
