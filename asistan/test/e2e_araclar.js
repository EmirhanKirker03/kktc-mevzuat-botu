// Uçtan uca: giriş, derin araştırma, takip sorusu, geçmiş, Word indir, süre hesabı, taslak, sözleşme incelemesi
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const S = __dirname, U = 'http://localhost:3100';
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); const hatalar = [];
  p.on('pageerror', e => hatalar.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') hatalar.push('console: ' + m.text()); });
  const ok = (k, v) => console.log((v ? 'GEÇTİ ' : 'KALDI ') + k);
  await p.goto(U + '/giris');
  await p.fill('input[type=email]', 'yonetici@test.local'); await p.fill('input[type=password]', 'yonetici12345');
  await p.click('button[type=submit]'); await p.waitForURL(U + '/'); await p.waitForTimeout(800);

  // derin araştırma
  await p.fill('#q', 'Hüküm aleyhine istinaf süresi nedir?');
  await p.click('#derinbtn');
  await p.waitForSelector('#answer .acts', { timeout: 30000 });
  ok('derin araştırma bölüm başlıkları', await p.locator('#answer h3.bol').count() >= 2);
  ok('derin araştırma alt sorular gösterildi', (await p.textContent('#answer')).includes('aranan alt sorular'));
  // Word indir
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=word]')]);
  const yol = S + '/not.docx'; await dl.saveAs(yol); ok('Word indirildi ' + dl.suggestedFilename(), fs.statSync(yol).size > 1000);
  // takip sorusu
  ok('takip çubuğu görünür', await p.isVisible('#devam'));
  await p.fill('#q', 'Peki ara emirlerde?'); await p.click('#ask');
  await p.waitForFunction(() => document.querySelector('#answer').textContent.includes('(takip)'), null, { timeout: 20000 });
  ok('takip sorusu önceki konuşmayla gönderildi', true);
  // geçmiş
  await p.click('#gbtn'); ok('geçmişte 2 kayıt', await p.locator('#glist [data-g]').count() === 2);
  await p.click('#glist [data-g="1"]'); ok('geçmişten cevap açıldı', (await p.textContent('#answer')).includes('Geçmişten'));

  // süre hesabı: 6 hafta istinaf, 2026-06-01 → 13 Temmuz 2026 Pazartesi (adli tatil uyarısı)
  await p.click('#tab-sure');
  await p.selectOption('#skural', 'ist-hukum'); await p.fill('#sbas', '2026-06-01'); await p.dispatchEvent('#sbas', 'input');
  let t = await p.textContent('#sonuc'); ok('6 hafta: 13 Temmuz 2026 Pazartesi', t.includes('13 Temmuz 2026 Pazartesi')); ok('adli tatil uyarısı', t.includes('adli tatile'));
  // 14 gün, son gün Pazar → Pazartesi: 2026-10-04 (Pazar) +14 = 18 Ekim Pazar → 19 Ekim
  await p.selectOption('#skural', 'ist-ara'); await p.fill('#sbas', '2026-10-04'); await p.dispatchEvent('#sbas', 'input');
  t = await p.textContent('#sonuc'); ok('Pazar → ertesi gün 19 Ekim 2026', t.includes('19 Ekim 2026 Pazartesi'));
  // 7 gün (≤6 değil), resmi tatil: 2026-10-22 +7 = 29 Ekim (tatil) → 30 Ekim
  await p.selectOption('#skural', 'resen-emir'); await p.fill('#sbas', '2026-10-22'); await p.dispatchEvent('#sbas', 'input');
  t = await p.textContent('#sonuc'); ok('29 Ekim tatil → 30 Ekim 2026 Cuma', t.includes('30 Ekim 2026 Cuma'));
  await p.fill('#snot', '2026/55 test'); await p.click('[data-skaydet]');
  ok('süre listeye eklendi', (await p.textContent('#slist')).includes('2026/55 test'));

  // taslak
  await p.click('#tab-taslak'); await p.waitForTimeout(1200);
  ok('HMUT formları yüklendi', await p.locator('#tturu option').count() > 70);
  await p.fill('#ttaraf', 'Davacı: Ayşe Demir, Girne · Davalı: Örnek Ltd.');
  await p.fill('#tolay', 'Ayşe Demir kiracı olarak oturduğu evden haksız yere çıkarılmak isteniyor, kira bedeli ödenmiştir. Tahliye talebine karşı koruma istiyoruz.');
  await p.click('#thazirla'); await p.waitForSelector('#tbelge', { timeout: 30000 });
  t = await p.textContent('#tcikti');
  ok('taslakta gizlenen ad geri açıldı', t.includes('Ayşe Demir') && !t.includes('[KİŞİ-1]'));
  ok('var olmayan madde (9999) yakalandı', t.includes('9999'));
  ok('kaynaksız hukuki paragraf işaretlendi', t.includes('kaynak gösterilmedi'));
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#tword')]);
  await dl2.saveAs(S + '/taslak.docx'); ok('taslak Word indirildi', fs.statSync(S + '/taslak.docx').size > 800);

  // sözleşme incelemesi
  await p.click('#tab-file'); await p.click('#risk');
  await p.waitForFunction(() => document.querySelector('#sumout').textContent.includes('Sözleşme incelemesi'), null, { timeout: 30000 });
  t = await p.textContent('#sumout');
  ok('1/2 alıntı bulunamadı uyarısı', t.includes('1 / 2 alıntı'));
  ok('kaynaksız eksik hüküm atıldı', t.includes('1 eksik hüküm tespiti gösterilmedi'));

  // telefon genişliği
  await p.setViewportSize({ width: 390, height: 844 }); await p.click('#tab-sure'); await p.click('#morebtn'); ok('telefonda Daha menüsünde Mevzuat var', await p.isVisible('#menu [data-go=pane-browse]')); await p.click('#tab-sure');
  const genis = await p.evaluate(() => document.documentElement.scrollWidth); ok('telefonda yatay kaydırma yok (' + genis + ')', genis <= 392);
  await p.screenshot({ path: S + '/sure_tel.png', fullPage: false });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.click('#tab-taslak'); await p.screenshot({ path: S + '/taslak.png' });
  await p.click('#tab-sure'); await p.screenshot({ path: S + '/sure.png' });
  console.log(hatalar.length ? hatalar.join('\n') : 'konsol hatası yok');
  await b.close();
})().catch(e => { console.error('HATA', e); process.exit(1); });
