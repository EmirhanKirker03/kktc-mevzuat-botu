// Mevzuat listesi araması ("Tüm yasa ve tüzükler"): numara, kısaltma ve konu ile aranan metin ilk sırada mı?
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const SET = [
  ['17/1981', /^17\/1981 — Kira \(Denetim\) Yasası/],
  ['Fasıl 154', /^Fasıl 154 — Ceza Yasası/],
  ['940/2026', /^940\/2026 — /],
  ['HMUT', /^453 — Hukuk Muhakemeleri Usulü Tüzüğü \(Birleştirilmiş\)/],
  ['hmut emir 35', /^453 — Hukuk Muhakemeleri Usulü Tüzüğü/],
  ['HMUY', /^Fasıl 6 — Hukuk Muhakemeleri Usulü Yasası/],
  ['CMUY', /^Fasıl 155 — Ceza Muhakemeleri Usulü Yasası/],
  ['kira', /^17\/1981 — Kira \(Denetim\) Yasası/],
  ['silah', /^Fasıl 57 — Ateşli Silahlar Yasası/],
  ['boşanma', /^1\/1998 — Aile \(Evlenme ve Boşanma\) Yasası/],
  ['Kat Mülkiyeti', /^35\/2010 — Kat Mülkiyeti ve Kat İrtifakı Yasası/],
  ['belediye harç', /Harç/],                               // açıkça aranan harç tüzükleri geri itilmez
  ['Hukuk Muhakemeleri Usulü Değişiklik 2024', /Değişiklik/], // açıkça aranan değişiklik tüzükleri geri itilmez
];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8811/kira_asistani.html'); await p.waitForTimeout(800);
  if (await p.isVisible('#tanitim')) await p.click('#tanit-gec');
  await p.click('#tab-browse'); await p.click('#pane-browse [data-go=pane-ym]');
  await p.waitForFunction(() => document.querySelectorAll('#ylist .catrow').length > 0, null, { timeout: 30000 });
  let ok = 0;
  for (const [q, beklenen] of SET) {
    await p.fill('#yq', q); await p.waitForTimeout(300);
    const ilk = await p.$$eval('#ylist .catrow', el => el.slice(0, 3).map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    const v = !!ilk[0] && beklenen.test(ilk[0]); if (v) ok++;
    console.log((v ? '✓ ' : '✗ ') + q + '\n     ' + ilk.map(x => x.slice(0, 100)).join('\n     '));
  }
  console.log('\nSONUÇ: ilk sırada doğru ' + ok + '/' + SET.length, 'errs', errs);
  await b.close();
})().catch(e => { console.error('HATA', e); process.exit(1); });
