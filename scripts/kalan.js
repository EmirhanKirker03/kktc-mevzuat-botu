// Yüksek Mahkeme sisteminde hâlâ alınamamış yasa ve tüzükler için son deneme.
//   node scripts/kalan.js [parça] [toplam]
// - Bağlantısı bozuk dosyalar (404): sitedeki dosya adının yaygın yazım hatalarını düzelterek dener
//   (".pdf" yerine "-pdf", uzantısız ad, "209/2016" → "209-2016", st önekli ad, numara/dosya adı uyuşmazlığı)
// - Zaman aşımına uğrayan büyük dosyalar: 15 dakikaya kadar bekler
// - Taranmış PDF: sayfa sayfa yazı tanıma (tesseract, Türkçe + İngilizce)
// - İçinde yalnızca resim olan Word dosyaları: resimler çıkarılıp yazı tanıma ile okunur
// - Excel dosyaları (ör. Avukat Ücretleri tarifesi): LibreOffice ile metin tablosuna çevrilir
// Sonuçlar veri/mahkemeler/kalan/ klasörüne ve kalan-kayit/parca-N.json dosyasına yazılır; ana kayıtlara dokunulmaz.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { BEKLE_MS, uyu, sha256, metinCikar, bicim } = require('./ortak');
const { oturumAc, istek, SITE } = require('./mahkemeler');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kalan-'));
const oku = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const yaz = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };
const temizAd = s => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80);
const ODIR = 'veri/mahkemeler/kalan';
const UZ = ['.pdf', '.doc', '.docx', '.PDF', '.DOC', '.DOCX', '.rtf', '.xlsx', '.xls'];

function adaylar(s, tur) {
  const kl = tur === 'yasa' ? '/Yasalar/' : '/Enstrumanlar/';
  const out = new Set();
  const ekle = ad => { if (ad) out.add(SITE + kl + ad.split('/').map(encodeURIComponent).join('/')); };
  const ad = (s.DosyaAd || '').trim();
  if (ad) {
    ekle(ad);
    const kok = ad.replace(/(\.pdf)+$/i, '').replace(/-(pdf|doc|docx)$/i, '').replace(/\.(docx?|rtf|xlsx?)$/i, '');
    for (const u of UZ) { ekle(kok + u); ekle(kok.replace(/\//g, '-') + u); }
  }
  // tüzük numarasından türetilen adlar: "256-2022", "209/2016", "338/2007"
  const no = String(s.AmmeEnstrumanNo || s.Numara || '').trim();
  const m = no.match(/^(\d+)\s*[-/.]\s*(\d{4})$/);
  if (m) {
    const [, n, y] = m;
    for (const k of [n + '-' + y, n + '.' + y, n + '_' + y, 'st' + n + '-' + y, n + '-' + y.slice(2)]) for (const u of ['.pdf', '.doc', '.docx', '.PDF']) ekle(k + u);
  }
  if (s.DownloadLink) out.add(SITE + s.DownloadLink.replace(/\?rnd=\d+$/, ''));
  return [...out];
}

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
function zipListe(f) { try { return execFileSync('unzip', ['-Z1', f]).toString().split('\n').filter(Boolean); } catch (e) { return []; } }
// Word içindeki resimleri (taranmış sayfalar) sırasıyla OCR et
function docxResimOcr(f) {
  const d = path.join(TMP, 'z' + Date.now()); fs.mkdirSync(d);
  execFileSync('unzip', ['-q', '-o', f, 'word/media/*', '-d', d], { stdio: 'ignore' });
  const md = path.join(d, 'word/media');
  const rs = fs.existsSync(md) ? fs.readdirSync(md).sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0)) : [];
  const parcalar = [];
  rs.forEach((r, i) => {
    let g = path.join(md, r);
    if (!/\.(png|jpe?g|tiff?|bmp|gif)$/i.test(r)) { try { execFileSync('convert', [g, g + '.png']); g += '.png'; } catch (e) { return; } }
    try { const t = execFileSync('tesseract', [g, 'stdout', '-l', 'tur+eng', '--psm', '3'], { timeout: 300000, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); parcalar.push('[SAYFA ' + (i + 1) + ']\n' + t.trim()); } catch (e) { /* atla */ }
  });
  fs.rmSync(d, { recursive: true, force: true });
  return { sayfa: rs.length, metin: parcalar.join('\n\n') };
}
function loCevir(f, hedef) {
  execFileSync('soffice', ['--headless', '--convert-to', hedef, '--outdir', TMP, f], { stdio: 'ignore', timeout: 300000 });
  const c = f.replace(/\.[^.]+$/, '.' + hedef.split(':')[0]);
  const t = fs.readFileSync(c, 'utf8'); fs.rmSync(c, { force: true }); return t;
}

async function oku_(buf, url) {
  const b = bicim(buf, url);
  if (b === 'html') throw new Error('HTML döndü');
  const f = path.join(TMP, 'g' + Date.now() + '.' + (b === 'docx' ? 'zip' : b)); fs.writeFileSync(f, buf);
  try {
    if (b === 'docx') {
      const l = zipListe(f);
      if (l.some(x => x.startsWith('xl/'))) { const g = f.replace(/\.zip$/, '.xlsx'); fs.renameSync(f, g); return { yontem: 'excel→csv (LibreOffice)', metin: loCevir(g, 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1') }; }
      const g = f.replace(/\.zip$/, '.docx'); fs.renameSync(f, g);
      let metin = ''; try { metin = (await metinCikar(buf, url)).metin; } catch (e) { /* */ }
      if (metin.trim().length >= 200) return { yontem: 'docx', metin };
      try { metin = loCevir(g, 'txt:Text (encoded):UTF8'); } catch (e) { /* */ }
      if (metin.trim().length >= 200) return { yontem: 'libreoffice', metin };
      const m = docxResimOcr(g); return { yontem: 'word içi resimler, ocr (tesseract tur+eng)', metin: m.metin, sayfa: m.sayfa };
    }
    if (b === 'xls') return { yontem: 'excel→csv (LibreOffice)', metin: loCevir(f, 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1') };
    let metin = ''; try { metin = (await metinCikar(buf, url)).metin; } catch (e) { /* */ }
    if (metin.trim().length >= 200) return { yontem: b, metin };
    if (b === 'pdf') { const m = pdfOcr(f); return { yontem: 'ocr (tesseract tur+eng, 300 dpi)', metin: m.metin, sayfa: m.sayfa }; }
    return { yontem: 'libreoffice', metin: loCevir(f, 'txt:Text (encoded):UTF8') };
  } finally { fs.rmSync(f, { force: true }); }
}

async function calis(parca, toplam) {
  const OK = 'veri/mahkemeler/kalan-kayit/parca-' + parca + '.json';
  const ok = fs.existsSync(OK) ? oku(OK) : {};
  fs.mkdirSync(ODIR, { recursive: true });
  const iler = [];
  for (const tur of ['yasa', 'tuzuk']) {
    const kayit = oku('veri/mahkemeler/' + tur + '-kayit.json');
    const ocrK = {};
    const od = 'veri/mahkemeler/ocr' + (tur === 'yasa' ? '' : '-tuzuk') + '-kayit';
    if (fs.existsSync(od)) for (const f of fs.readdirSync(od)) Object.assign(ocrK, oku(path.join(od, f)));
    for (const s of oku('liste/mahkemeler-' + tur + '.json').kayitlar) {
      const k = kayit[s.Pkey]; if (!k || k.durum === 'tamam') continue;
      if (ocrK[s.Pkey] && ocrK[s.Pkey].durum === 'tamam') continue;
      if (!(s.DosyaAd || '').trim() && !String(s.AmmeEnstrumanNo || '').match(/\d+\s*[-/.]\s*\d{4}/)) continue; // dosyası hiç yüklenmemiş
      iler.push({ tur, s, k });
    }
  }
  const benim = iler.filter((x, i) => i % toplam === parca).filter(x => !(ok[x.tur + x.s.Pkey] && ok[x.tur + x.s.Pkey].durum === 'tamam'));
  console.log('Toplam kalan ' + iler.length + ', bu parça ' + benim.length);
  await oturumAc();
  const t0 = Date.now();
  for (const { tur, s, k } of benim) {
    if (Date.now() - t0 > 5.2 * 3600 * 1000) { console.log('Süre doldu'); break; }
    const o = { tur, pkey: s.Pkey, numara: k.numara, ad: k.ad, alindi: new Date().toISOString(), denenen: [] };
    for (const url of adaylar(s, tur)) {
      try {
        const r = await istek(url, { zaman: 900000 }, 2);
        if (!r.ok) { o.denenen.push(url.replace(SITE, '') + ' → ' + r.status); await r.arrayBuffer().catch(() => {}); await uyu(BEKLE_MS); continue; }
        const buf = Buffer.from(await r.arrayBuffer()); await uyu(BEKLE_MS);
        o.denenen.push(url.replace(SITE, '') + ' → 200 (' + buf.length + ' bayt)');
        if (buf.length < 100 || bicim(buf, url) === 'html') continue;
        const m = await oku_(buf, url);
        const ad = tur + '_' + s.Pkey + '_' + temizAd(url.split('/').pop()) + '.txt';
        fs.writeFileSync(path.join(ODIR, ad), m.metin);
        Object.assign(o, { url, bayt: buf.length, sha256: sha256(buf), yontem: m.yontem, sayfa: m.sayfa, karakter: m.metin.length, metin_dosyasi: ODIR + '/' + ad,
          durum: m.metin.replace(/\[SAYFA \d+\]/g, '').trim().length < 200 ? 'metin-cok-kisa' : 'tamam' });
        if (o.durum === 'tamam') break;
      } catch (e) { o.denenen.push(url.replace(SITE, '') + ' → ' + String(e.message || e).slice(0, 80)); }
    }
    if (!o.durum) o.durum = 'bulunamadi';
    ok[tur + s.Pkey] = o; yaz(OK, ok);
    console.log((o.durum === 'tamam' ? '✓ ' : '✗ ') + tur + ' ' + k.numara + ' ' + String(k.ad).slice(0, 50) + ' — ' + (o.yontem || '') + ' ' + (o.karakter || 0) + ' krk');
  }
}
if (require.main === module) {
  calis(Number(process.argv[2] || 0), Number(process.argv[3] || 1)).then(() => fs.rmSync(TMP, { recursive: true, force: true })).catch(e => { console.error('HATA: ' + (e.message || e)); process.exit(1); });
}
