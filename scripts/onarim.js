// Mahkemeler sitesindeki yasa dosyalarında kalan sorunları giderir.
// Kullanım:
//   node scripts/onarim.js onar            → indirilemeyen/okunamayan dosyaları yeniden dener (farklı adres biçimleri,
//                                            LibreOffice ile metin çıkarma)
//   node scripts/onarim.js ocr <parça> <toplam> → taranmış (resim) PDF'leri yazı tanıma (OCR, tesseract, Türkçe) ile
//                                            metne çevirir; iş paralel parçalara bölünür
//   node scripts/onarim.js lo [yasa|tuzuk]   → Word dosyalarının metnini LibreOffice ile yeniden çıkarır
//                                            (Word'ün otomatik madde numaralarını korur; maddelere ayırmayı kolaylaştırır)
// OCR metni makine okumasıdır; hata içerebilir. Bu yüzden ayrı klasörde ve "ocr" işaretiyle saklanır.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { BEKLE_MS, uyu, sha256, metinCikar, bicim } = require('./ortak');
const { oturumAc, istek, SITE } = require('./mahkemeler');

const temizAd = s => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'onarim-'));
const oku = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const yaz = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };

async function getir(url) {
  const r = await istek(url);
  const buf = Buffer.from(await r.arrayBuffer());
  return { r, buf };
}

// LibreOffice ile her türlü Word/RTF/ODT dosyasını düz metne çevir (numaralı listeler korunur)
function loMetin(buf, uzanti) {
  const g = path.join(TMP, 'g' + Date.now() + '.' + uzanti);
  fs.writeFileSync(g, buf);
  execFileSync('soffice', ['--headless', '--convert-to', 'txt:Text (encoded):UTF8', '--outdir', TMP, g], { stdio: 'ignore', timeout: 180000 });
  const c = g.replace(/\.[^.]+$/, '.txt');
  const t = fs.readFileSync(c, 'utf8');
  fs.rmSync(g, { force: true }); fs.rmSync(c, { force: true });
  return t;
}

function adresSecenekleri(s) {
  const out = new Set();
  if (s.url) out.add(s.url);
  const ad = s.DosyaAd || '';
  if (ad) {
    const kok = ad.replace(/\.[^.]+$/, '');
    for (const u of ['.doc', '.docx', '.pdf', '.DOC', '.DOCX', '.PDF', '.rtf']) out.add(SITE + '/Yasalar/' + encodeURIComponent(kok + u).replace(/%2F/g, '/'));
    out.add(SITE + '/Yasalar/' + ad.split('/').map(encodeURIComponent).join('/'));
  }
  if (s.DownloadLink) out.add(SITE + s.DownloadLink.replace(/\?rnd=\d+$/, ''));
  return [...out];
}

async function onar() {
  const KAYIT = 'veri/mahkemeler/yasa-kayit.json';
  const kayit = oku(KAYIT);
  const L = oku('liste/mahkemeler-yasa.json').kayitlar;
  const sec = L.filter(s => kayit[s.Pkey] && kayit[s.Pkey].durum === 'sorun');
  console.log(sec.length + ' sorunlu kayıt yeniden denenecek');
  await oturumAc();
  let duzelen = 0;
  for (const s of sec) {
    const k = kayit[s.Pkey]; const denenen = [];
    for (const url of adresSecenekleri(s)) {
      try {
        const { r, buf } = await getir(url); await uyu(BEKLE_MS);
        denenen.push(url.replace(SITE, '') + ' → ' + r.status);
        if (!r.ok || buf.length < 100) continue;
        const b = bicim(buf, url);
        if (b === 'html') continue;
        let metin, yontem;
        try { const m = await metinCikar(buf, url); metin = m.metin; yontem = m.bicim; } catch (e) { /* LibreOffice'e bırak */ }
        if ((!metin || metin.trim().length < 200) && b !== 'pdf') { metin = loMetin(buf, ['doc', 'docx', 'rtf'].includes(b) ? b : 'doc'); yontem = 'libreoffice'; }
        if (!metin) continue;
        const ad = s.Pkey + '_' + temizAd(url.split('/').pop()) + '.txt';
        fs.writeFileSync(path.join('veri/mahkemeler/yasalar', ad), metin);
        Object.assign(k, { url, http: r.status, bayt: buf.length, sha256: sha256(buf), bicim: b, cikarma: yontem,
          karakter: metin.length, metin_dosyasi: 'veri/mahkemeler/yasalar/' + ad, alindi: new Date().toISOString(),
          durum: metin.trim().length < 200 ? 'metin-cok-kisa' : 'tamam', onarim: 'yeniden denendi' });
        delete k.hata; duzelen++;
        break;
      } catch (e) { denenen.push(url.replace(SITE, '') + ' → ' + (e.message || e)); }
    }
    k.denenen_adresler = denenen;
    console.log((k.durum === 'sorun' ? '✗ ' : '✓ ') + k.numara + ' ' + k.ad.slice(0, 60));
  }
  yaz(KAYIT, kayit);
  console.log('\nDüzelen: ' + duzelen + ' / ' + sec.length);
}

// Sayfa sayfa: PDF → 300 dpi gri resim → tesseract (Türkçe + İngilizce; eski yasalarda İngilizce bölümler var)
function pdfOcr(dosya) {
  const bilgi = execFileSync('pdfinfo', [dosya]).toString();
  const sayfa = Number((bilgi.match(/Pages:\s+(\d+)/) || [])[1] || 0);
  const parcalar = [];
  for (let p = 1; p <= sayfa; p++) {
    const kok = path.join(TMP, 's');
    execFileSync('pdftoppm', ['-r', '300', '-gray', '-png', '-f', String(p), '-l', String(p), '-singlefile', dosya, kok], { timeout: 300000 });
    const t = execFileSync('tesseract', [kok + '.png', 'stdout', '-l', 'tur+eng', '--psm', '3'], { timeout: 300000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    fs.rmSync(kok + '.png', { force: true });
    parcalar.push('[SAYFA ' + p + ']\n' + t.trim());
  }
  return { sayfa, metin: parcalar.join('\n\n') };
}

async function ocr(parca, toplam, tur = 'yasa') {
  const kayit = oku('veri/mahkemeler/' + tur + '-kayit.json');
  const ek = tur === 'yasa' ? '' : '-' + tur;
  const ODIR = 'veri/mahkemeler/ocr' + ek;
  const OKAYIT = 'veri/mahkemeler/ocr' + ek + '-kayit/parca-' + parca + '.json';
  const okayit = fs.existsSync(OKAYIT) ? oku(OKAYIT) : {};
  fs.mkdirSync(ODIR, { recursive: true });
  const L = oku('liste/mahkemeler-' + tur + '.json').kayitlar.filter(s => kayit[s.Pkey] && kayit[s.Pkey].durum === 'metin-cok-kisa')
    .filter(s => s.Pkey % toplam === parca && !(okayit[s.Pkey] && okayit[s.Pkey].durum === 'tamam'));
  console.log('Parça ' + parca + '/' + toplam + ': ' + L.length + ' dosya');
  await oturumAc();
  const t0 = Date.now();
  for (const s of L) {
    if (Date.now() - t0 > 5.3 * 3600 * 1000) { console.log('Süre doldu, kalanlar sonraki çalıştırmada'); break; }
    const k = kayit[s.Pkey];
    const o = { pkey: s.Pkey, numara: k.numara, ad: k.ad, url: k.url, alindi: new Date().toISOString() };
    try {
      const { r, buf } = await getir(k.url); await uyu(BEKLE_MS);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      o.sha256 = sha256(buf); o.bayt = buf.length;
      const b = bicim(buf, k.url);
      let m;
      if (b === 'pdf') {
        const f = path.join(TMP, 'd.pdf'); fs.writeFileSync(f, buf);
        m = pdfOcr(f); fs.rmSync(f, { force: true });
        o.yontem = 'ocr (tesseract tur+eng, 300 dpi)'; o.sayfa = m.sayfa;
      } else {
        m = { metin: loMetin(buf, ['doc', 'docx', 'rtf'].includes(b) ? b : 'doc') }; o.yontem = 'libreoffice';
      }
      const ad = s.Pkey + '_' + temizAd(String(k.url).split('/').pop()) + '.txt';
      fs.writeFileSync(path.join(ODIR, ad), m.metin);
      Object.assign(o, { karakter: m.metin.length, metin_dosyasi: ODIR + '/' + ad, durum: m.metin.replace(/\[SAYFA \d+\]/g, '').trim().length < 200 ? 'metin-cok-kisa' : 'tamam' });
    } catch (e) { o.durum = 'sorun'; o.hata = String(e.message || e).slice(0, 300); }
    okayit[s.Pkey] = o; yaz(OKAYIT, okayit);
    console.log((o.durum === 'tamam' ? '✓ ' : '✗ ') + o.numara + ' ' + String(o.ad).slice(0, 50) + ' — ' + (o.sayfa || '?') + ' sayfa, ' + (o.karakter || 0) + ' krk' + (o.hata ? ' — ' + o.hata : ''));
  }
}

async function lo(tur) {
  const KAYIT = 'veri/mahkemeler/' + tur + '-kayit.json';
  const kayit = oku(KAYIT);
  const ODIR = 'veri/mahkemeler/' + (tur === 'yasa' ? 'yasalar' : 'tuzukler') + '-lo';
  const LKAYIT = 'veri/mahkemeler/' + tur + '-lo-kayit.json';
  const lk = fs.existsSync(LKAYIT) ? oku(LKAYIT) : {};
  fs.mkdirSync(ODIR, { recursive: true });
  const sec = Object.values(kayit).filter(k => k.durum === 'tamam' && ['doc', 'docx', 'rtf'].includes(k.bicim) && !(lk[k.pkey] && lk[k.pkey].durum === 'tamam'));
  console.log(sec.length + ' Word dosyası LibreOffice ile yeniden çıkarılacak');
  await oturumAc();
  const t0 = Date.now();
  for (const k of sec) {
    if (Date.now() - t0 > 5.3 * 3600 * 1000) break;
    const o = { pkey: k.pkey, url: k.url };
    try {
      const { r, buf } = await getir(k.url); await uyu(BEKLE_MS);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      o.sha256 = sha256(buf); o.ayni_dosya = o.sha256 === k.sha256;
      const t = loMetin(buf, k.bicim);
      const ad = k.pkey + '_' + temizAd(String(k.url).split('/').pop()) + '.txt';
      fs.writeFileSync(path.join(ODIR, ad), t);
      Object.assign(o, { karakter: t.length, metin_dosyasi: ODIR + '/' + ad, durum: 'tamam' });
    } catch (e) { o.durum = 'sorun'; o.hata = String(e.message || e).slice(0, 300); }
    lk[k.pkey] = o;
    if (Object.keys(lk).length % 25 === 0) yaz(LKAYIT, lk);
  }
  yaz(LKAYIT, lk);
  console.log('Bitti: ' + Object.values(lk).filter(x => x.durum === 'tamam').length + ' tamam');
}

if (require.main === module) {
  const [komut, a, b] = process.argv.slice(2);
  const is = komut === 'onar' ? onar() : komut === 'ocr' ? ocr(Number(a), Number(b), process.argv[5] || 'yasa') : komut === 'lo' ? lo(a || 'yasa') : Promise.reject(new Error('komut: onar | ocr <parça> <toplam> | lo [yasa|tuzuk]'));
  is.then(() => fs.rmSync(TMP, { recursive: true, force: true })).catch(e => { console.error('HATA: ' + (e.message || e)); process.exit(1); });
}
