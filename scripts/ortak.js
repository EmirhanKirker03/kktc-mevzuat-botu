// Ortak yardımcılar: nazik indirme ve metin çıkarma.
const crypto = require('crypto');
const WordExtractor = require('word-extractor');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const mammoth = require('mammoth');

const SITE = process.env.SITE || 'http://cm.gov.ct.tr';
// Bot ne olduğunu dürüstçe söyler (tarayıcı taklidi yapmaz) ama kişisel bilgi veya depo adresi içermez.
const UA = 'KKTC-Mevzuat-Arastirma-Botu/0.1 (kamuya acik yasa arsivi; yavas tarama, istekler arasi 2 sn)';
const BEKLE_MS = Number(process.env.BEKLE_MS || 2000); // iki istek arası bekleme

const uyu = ms => new Promise(r => setTimeout(r, ms));
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

function dosyaUrl(dosya) {
  return SITE + '/Yasalar/' + dosya.split('/').map(encodeURIComponent).join('/');
}

async function indir(url, deneme = 3) {
  let son;
  for (let i = 1; i <= deneme; i++) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000), redirect: 'follow' });
      const buf = Buffer.from(await r.arrayBuffer());
      return { ok: r.ok, durum: r.status, tur: r.headers.get('content-type') || '', bayt: buf.length, sure_ms: Date.now() - t0, buf };
    } catch (e) {
      son = { ok: false, durum: 0, hata: String(e && (e.cause && e.cause.code || e.message) || e), sure_ms: Date.now() - t0 };
      if (i < deneme) await uyu(BEKLE_MS * i * 2);
    }
  }
  return son;
}

// Belgenin biçimini dosya adına değil, içeriğin ilk baytlarına bakarak anla.
function bicim(buf, dosya) {
  const h = buf.subarray(0, 8);
  if (h[0] === 0xD0 && h[1] === 0xCF && h[2] === 0x11 && h[3] === 0xE0) return 'doc';
  if (h[0] === 0x50 && h[1] === 0x4B) return 'docx';
  if (h.toString('latin1', 0, 4) === '%PDF') return 'pdf';
  if (h.toString('latin1', 0, 5) === '{\\rtf') return 'rtf';
  if (/<html/i.test(buf.subarray(0, 600).toString('latin1'))) return 'html';
  return (dosya.split('.').pop() || '').toLowerCase();
}

function rtfMetin(s) {
  return s.replace(/\\par[d]?/g, '\n').replace(/\\'([0-9a-f]{2})/gi, (_, x) => Buffer.from([parseInt(x, 16)]).toString('latin1'))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode((+n + 65536) % 65536))
    .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

async function metinCikar(buf, dosya) {
  const b = bicim(buf, dosya);
  if (b === 'html') throw new Error('Sunucu belge yerine HTML sayfası döndürdü (dosya yok olabilir)');
  if (b === 'doc') {
    // filterUnicode:false → tırnak işaretleri dahil metin birebir kalır
    const d = await new WordExtractor().extract(buf);
    return { bicim: b, metin: d.getBody({ filterUnicode: false }) };
  }
  if (b === 'docx') {
    const d = await mammoth.extractRawText({ buffer: buf });
    return { bicim: b, metin: d.value };
  }
  if (b === 'pdf') {
    const d = await pdfParse(buf);
    return { bicim: b, metin: d.text, sayfa: d.numpages };
  }
  if (b === 'rtf') return { bicim: b, metin: rtfMetin(buf.toString('latin1')) };
  throw new Error('Bilinmeyen biçim: ' + b);
}

module.exports = { SITE, UA, BEKLE_MS, uyu, sha256, dosyaUrl, indir, bicim, metinCikar };
