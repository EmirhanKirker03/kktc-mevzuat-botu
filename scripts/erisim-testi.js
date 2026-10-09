// 1. adım: GitHub sunucusu Meclis sitesine ulaşabiliyor mu?
// Yalnızca 3 istek atar ve sonucu sonuc/erisim-testi.json dosyasına yazar.
const fs = require('fs');
const { SITE, UA, uyu, sha256, dosyaUrl, indir, metinCikar } = require('./ortak');
const M = require('./mahkemeler');

(async () => {
  fs.mkdirSync('sonuc', { recursive: true });
  const sonuc = { zaman: new Date().toISOString(), kimlik: UA, testler: [] };
  const hedefler = [
    { ad: 'Yasalar sayfası', url: SITE + '/Yasalarr.aspx' },
    { ad: 'Örnek .doc (Kira Denetim 17/1981)', url: dosyaUrl('17-1981.doc'), dosya: '17-1981.doc' },
    { ad: 'Örnek .docx (Aile Yasası değişikliği 46/2023)', url: dosyaUrl('3661982_Aile Yasası 19-2-2023.docx'), dosya: '3661982_Aile Yasası 19-2-2023.docx' },
  ];
  for (const h of hedefler) {
    const r = await indir(h.url, 2);
    const t = { ad: h.ad, url: h.url, ok: r.ok, durum: r.durum, bayt: r.bayt, sure_ms: r.sure_ms, hata: r.hata };
    if (r.ok && h.dosya) {
      t.sha256 = sha256(r.buf);
      try {
        const m = await metinCikar(r.buf, h.dosya);
        t.bicim = m.bicim; t.karakter = m.metin.length; t.ilk_300 = m.metin.slice(0, 300);
        fs.mkdirSync('sonuc', { recursive: true });
        fs.writeFileSync('sonuc/test-' + h.dosya.replace(/[^\w.-]+/g, '_') + '.txt', m.metin);
      } catch (e) { t.metin_hatasi = String(e.message || e); }
    }
    sonuc.testler.push(t);
    console.log((t.ok ? 'BAŞARILI ' : 'BAŞARISIZ ') + t.ad + ' — durum ' + t.durum + (t.hata ? ' — ' + t.hata : '') + (t.karakter ? ' — ' + t.karakter + ' karakter metin' : ''));
    await uyu(2000);
  }
  // Yüksek Mahkeme mevzuat sistemi: misafir oturumu + liste + bir dosya
  const mt = { ad: 'mahkemeler.net mevzuat sistemi' };
  try {
    await M.oturumAc();
    const j = await M.sayfa('yasa', 0, 5);
    mt.yasa_sayisi = j.recordsTotal;
    await uyu(2000);
    const r = await M.istek(M.SITE + '/Yasalar/17-1981.doc');
    const buf = Buffer.from(await r.arrayBuffer());
    mt.dosya_durum = r.status; mt.bayt = buf.length;
    if (r.ok) { const m = await metinCikar(buf, '17-1981.doc'); mt.karakter = m.metin.length; mt.ilk_300 = m.metin.slice(0, 300);
      fs.writeFileSync('sonuc/test-mahkemeler-17-1981.txt', m.metin); }
    mt.ok = !!(j.recordsTotal && r.ok);
  } catch (e) { mt.ok = false; mt.hata = String(e.message || e); }
  sonuc.testler.push(mt);
  console.log((mt.ok ? 'BAŞARILI ' : 'BAŞARISIZ ') + mt.ad + (mt.yasa_sayisi ? ' — ' + mt.yasa_sayisi + ' yasa listelendi' : '') + (mt.hata ? ' — ' + mt.hata : ''));
  sonuc.ozet = sonuc.testler.every(t => t.ok) ? 'ERİŞİM VAR' : (sonuc.testler.some(t => t.ok) ? 'KISMİ ERİŞİM' : 'ERİŞİM YOK');
  fs.mkdirSync('sonuc', { recursive: true });
  fs.mkdirSync('sonuc', { recursive: true });
  fs.writeFileSync('sonuc/erisim-testi.json', JSON.stringify(sonuc, null, 1));
  console.log('\nSONUÇ: ' + sonuc.ozet);
})();
