'use strict';
// Tarayıcı testi: sahte istemci + uygulama + telefon boyutunda Chromium (Playwright gerekir).
//   node scripts/e2e-browser.js [ekran-görüntüsü-klasörü]
// Akış: lobi → sıraya gir → maç bulundu → kabul → ban (arama ile) → seçim → kilitle → büyü/rün.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

let chromium;
let devices;
try {
  ({ chromium, devices } = require('playwright'));
} catch (_) {
  console.log('Playwright kurulu değil; tarayıcı testi atlandı. (npm i -D playwright && npx playwright install chromium)');
  process.exit(0);
}

const { startMockLcu } = require('../mock/mock-lcu');
const { createApp } = require('../src/app');
const { Config } = require('../src/config');
const { silent } = require('../src/log');

const shotsDir = process.argv[2] || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lolk-e2e-'));
  const mock = await startMockLcu({
    fetchIcons: false,
    timings: { queue: 1500, settle: 500, planning: 3000, ban: 20000, reveal: 800, pick: 20000, finalization: 15000, gameStarting: 800, game: 3000 },
  });
  const config = new Config(path.join(tmp, 'config.json'));
  config.update({ favorites: { pick: [103, 238, 99], ban: [157] } });
  const app = await createApp({ config, log: silent, lockfile: mock.lockfile, port: 0, host: '127.0.0.1', pollMs: 500, telegram: false });
  const url = `http://127.0.0.1:${app.port}/?t=${config.data.token}`;

  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'tr-TR' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  let n = 0;
  const shot = async (name) => {
    if (!shotsDir) return;
    fs.mkdirSync(shotsDir, { recursive: true });
    n += 1;
    await page.screenshot({ path: path.join(shotsDir, `${String(n).padStart(2, '0')}-${name}.png`) });
  };
  const step = (s) => console.log(`• ${s}`);

  try {
    await page.goto(url);
    await page.waitForSelector('#screen-home:not([hidden])');
    await page.waitForSelector('text=Sıraya gir');
    step('Ana ekran: lobi görünüyor');
    await shot('lobi');

    await page.click('text=Sıraya gir');
    await page.waitForSelector('#queue-elapsed');
    step('Sıraya girildi');
    await shot('sirada');

    await page.waitForSelector('#screen-ready:not([hidden])', { timeout: 10000 });
    await page.waitForSelector('#btn-accept:visible');
    step('Maç bulundu ekranı');
    await shot('mac-bulundu');
    await page.click('#btn-accept');
    await page.waitForSelector('text=Kabul edildi');
    await shot('kabul-edildi');

    await page.waitForSelector('#screen-cs:not([hidden])', { timeout: 10000 });
    step('Şampiyon seçimi (planlama)');
    await page.waitForSelector('#grid .champ');
    // Planlamada niyet: favorilerden Ahri
    await page.click('#fav-grid .champ[data-id="103"]');
    await page.waitForFunction(() => document.querySelector('#confirm-name').textContent.includes('Ahri'));
    await shot('planlama-niyet');

    await page.waitForSelector('#cs-turn.mine-ban', { timeout: 20000 });
    step('Ban sırası geldi');
    await page.fill('#search', 'yas');
    await page.waitForFunction(() => document.querySelectorAll('#grid .champ').length >= 1 && document.querySelector('#grid .champ').getAttribute('aria-label') === 'Yasuo');
    await page.click('#grid .champ[data-id="157"]');
    await page.waitForFunction(() => document.querySelector('#confirm-name').textContent === 'Yasuo');
    await shot('ban-secildi');
    await page.click('#btn-lock');
    await page.waitForFunction(() => document.querySelector('#bans-ally').innerHTML.includes('Yasuo'), null, { timeout: 10000 });
    step('Yasuo banlandı');

    await page.waitForSelector('#cs-turn.mine-pick', { timeout: 40000 });
    step('Seçim sırası geldi');
    await sleep(400);
    // Niyet olarak işaretlenen Ahri hâlâ uygunsa otomatik işaretli gelir; rakip banladıysa ilk uygun şampiyon seçilir
    const preset = await page.textContent('#confirm-name');
    if (preset !== 'Ahri') {
      step(`Ahri uygun değil (rakip banlamış olabilir); ilk uygun şampiyon seçiliyor`);
      await page.click('#grid .champ:not(.off)');
      await page.waitForFunction(() => !document.querySelector('#btn-lock').disabled);
    }
    const chosen = await page.textContent('#confirm-name');
    await shot('secim-sirasi');
    await page.click('#btn-lock');
    await page.waitForSelector('#tab-loadout:not([hidden])', { timeout: 10000 });
    step(`${chosen} kilitlendi; büyü/rün sekmesine geçildi`);
    await page.waitForSelector('.spell-slot');
    await page.click('.spell-slot[data-slot="2"]');
    await page.waitForSelector('#spell-list:not([hidden]) .spell-opt');
    await page.click('.spell-opt[data-spell="14"]');
    await page.waitForFunction(() => document.querySelector('.spell-slot[data-slot="2"]').textContent.includes('Tutuştur'), null, { timeout: 5000 });
    await page.click('.page[data-page="103"]');
    await page.waitForSelector('.page.on[data-page="103"]');
    await shot('buyu-run');

    await page.click('#tab-btn-champs');
    await page.waitForSelector('.request', { timeout: 45000 });
    step('Takas isteği göründü');
    await shot('takas');
    await page.click('.request button[data-req$=":0"]');

    await page.waitForSelector('#screen-game:not([hidden])', { timeout: 40000 });
    step('Oyun ekranı');
    await page.waitForSelector('#btn-play-again:visible', { timeout: 20000 });
    await shot('oyun-bitti');
    await page.click('#btn-play-again');
    await page.waitForSelector('#screen-home:not([hidden])');
    step('Lobiye dönüldü');

    await page.click('#btn-settings');
    await page.waitForSelector('#sheet:not([hidden])');
    await sleep(450); // açılış animasyonu
    await shot('ayarlar');
    await page.click('#set-auto');
    await sleep(300);
    assert.strictEqual(config.data.autoAccept, true, 'otomatik kabul ayarı kaydedilmeli');
    await page.click('#btn-close-sheet');

    const writes = mock.calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`);
    assert(writes.includes('POST /lol-matchmaking/v1/ready-check/accept'), 'kabul isteği gitmeli');
    assert(writes.some((w) => /\/actions\/\d+\/complete$/.test(w)), 'kilitleme isteği gitmeli');
    assert(writes.includes('PATCH /lol-champ-select/v1/session/my-selection'), 'büyü isteği gitmeli');
    assert(writes.includes('PUT /lol-perks/v1/currentpage'), 'rün isteği gitmeli');
    assert(writes.includes('POST /lol-champ-select/v1/session/trades/2/decline') || writes.some((w) => /trades\/\d+\/decline/.test(w)), 'takas reddi gitmeli');
    assert.deepStrictEqual(errors, [], `tarayıcı hatası olmamalı: ${errors.join(' | ')}`);
    console.log('\nTarayıcı testi BAŞARILI ✓');
  } finally {
    await browser.close();
    await app.close();
    await mock.close();
  }
}

main().catch((e) => {
  console.error('\nTarayıcı testi BAŞARISIZ ✗\n', e);
  process.exit(1);
});
