'use strict';
// Telegram botu: sahte Telegram sunucusu + sahte League istemcisiyle uçtan uca.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startMockLcu } = require('../mock/mock-lcu');
const { MockTelegram } = require('../mock/mock-telegram');
const { createApp } = require('../src/app');
const { Config } = require('../src/config');
const { silent } = require('../src/log');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, label, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await pred();
    if (v) return v;
    await sleep(50);
  }
  throw new Error(`zaman aşımı: ${label}`);
}
const buttons = (msg) => (msg && msg.reply_markup && msg.reply_markup.inline_keyboard ? msg.reply_markup.inline_keyboard.flat() : []);

test('Telegram: eşleştirme, maç kabulü, ban ve seçim', { timeout: 90000 }, async (t) => {
  const CHAT = 424242;
  const tg = await new MockTelegram().start();
  const mock = await startMockLcu({
    fetchIcons: false,
    timings: { queue: 500, settle: 200, planning: 1500, ban: 9000, reveal: 300, pick: 9000, finalization: 3000, gameStarting: 300, game: 1000 },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lolk-tg-'));
  const config = new Config(path.join(dir, 'config.json'));
  config.update({ telegram: { token: tg.token, chatId: 0 }, favorites: { pick: [103, 238], ban: [157, 238] } });
  const app = await createApp({ config, log: silent, lockfile: mock.lockfile, port: 0, host: '127.0.0.1', pollMs: 300, telegramApiBase: tg.url });
  t.after(async () => {
    await app.close();
    await mock.close();
    await tg.close();
  });

  // 1) Eşleştirme kodu üretilir
  await until(() => app.telegram.info().status === 'pairing', 'eşleştirme bekleniyor');
  const code = app.telegram.info().pairCode;
  assert.match(code, /^\d{6}$/);
  assert.strictEqual(app.telegram.info().botName, 'lolk_test_bot');

  // Yanlış kod kabul edilmez
  tg.pushMessage(CHAT, '/start 000000');
  await tg.waitForSent((m) => m.chat_id === CHAT && /özeldir/.test(m.text));
  assert.strictEqual(config.data.telegram.chatId, 0);

  // Doğru kod
  tg.pushMessage(CHAT, `/start ${code}`);
  await tg.waitForSent((m) => /Eşleştirildi/.test(m.text));
  assert.strictEqual(config.data.telegram.chatId, CHAT);
  assert.strictEqual(app.telegram.info().status, 'ready');

  // Yabancı sohbet yok sayılır
  const before = tg.sent.length;
  tg.pushMessage(777, '/sira');
  await sleep(400);
  assert.strictEqual(tg.sent.length, before);
  assert.strictEqual(mock.phase, 'Lobby');

  // 2) Telegram'dan sıraya gir
  await until(() => app.state.raw.phase === 'Lobby', 'lobi');
  tg.pushMessage(CHAT, '/sira');
  await tg.waitForSent((m) => /Sıraya girildi/.test(m.text));

  // 3) Maç bulundu bildirimi + Kabul et düğmesi
  const rcMsg = await tg.waitForSent((m) => /Maç bulundu!/.test(m.text), 10000);
  const acceptBtn = buttons(rcMsg).find((b) => b.callback_data.startsWith('rc:a:'));
  assert.ok(acceptBtn, 'Kabul düğmesi olmalı');
  // Eski (yanlış kimlikli) düğme işe yaramaz
  tg.pushCallback(CHAT, rcMsg.message_id, 'rc:a:eskikod');
  await until(() => tg.answers.length >= 1, 'eski düğme yanıtı');
  assert.match(tg.answers[0].text, /geçerli değil/);
  tg.pushCallback(CHAT, rcMsg.message_id, acceptBtn.callback_data);
  await until(() => mock.calls.some((c) => c.path === '/lol-matchmaking/v1/ready-check/accept'), 'kabul isteği');
  await until(() => tg.edits.some((e) => e.message_id === rcMsg.message_id && /Maç başladı|kabul edildi/.test(e.text)), 'mesaj güncellendi');

  // 4) Planlamada metinle niyet
  await until(() => app.state.raw.session, 'şampiyon seçimi');
  tg.pushMessage(CHAT, 'ahri');
  await tg.waitForSent((m) => /Niyet olarak işaretlendi/.test(m.text));

  // 5) Ban sırası: favori düğmesi → onay → banla
  const banMsg = await tg.waitForSent((m) => /Ban sırası sende/.test(m.text), 15000);
  const yasuo = buttons(banMsg).find((b) => b.text === 'Yasuo');
  assert.ok(yasuo, 'Ban favorisi Yasuo düğmesi olmalı');
  tg.pushCallback(CHAT, banMsg.message_id, yasuo.callback_data);
  const confirmEdit = await until(() => tg.edits.find((e) => e.message_id === banMsg.message_id && /Banlansın mı/.test(e.text)), 'ban onayı');
  const banBtn = buttons(confirmEdit).find((b) => b.callback_data.startsWith('l:'));
  tg.pushCallback(CHAT, banMsg.message_id, banBtn.callback_data);
  await until(() => app.state.view().champSelect && app.state.view().champSelect.bans.ally.includes(157), 'Yasuo banlandı');

  // 6) Seçim sırası: şampiyon adını yaz → Kilitle
  await tg.waitForSent((m) => /Seçim sırası sende/.test(m.text), 30000);
  const avail = app.state.view().champSelect.pickable;
  const name = avail.includes(103) ? 'ahri' : 'lux';
  const expectedId = avail.includes(103) ? 103 : 99;
  tg.pushMessage(CHAT, name);
  const pickConfirm = await tg.waitForSent((m) => /Kilitlensin mi/.test(m.text));
  const lockBtn = buttons(pickConfirm).find((b) => b.callback_data.startsWith('l:'));
  tg.pushCallback(CHAT, pickConfirm.message_id, lockBtn.callback_data);
  await until(() => {
    const cs = app.state.view().champSelect;
    return cs && cs.my.lockedChampionId === expectedId;
  }, 'kilitlendi');

  // 7) Durum komutu
  tg.pushMessage(CHAT, '/durum');
  await tg.waitForSent((m) => /Seçimin/.test(m.text));

  if (process.env.LOLK_DUMP_TG) {
    for (const m of tg.sent) console.log(`>> ${m.text}${buttons(m).length ? `\n   [${buttons(m).map((b) => b.text).join('] [')}]` : ''}`);
    for (const e of tg.edits) console.log(`~~ #${e.message_id}: ${e.text}`);
  }
});

test('Telegram: geçersiz anahtar hata durumuna düşer', { timeout: 20000 }, async (t) => {
  const tg = await new MockTelegram().start();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lolk-tg2-'));
  const config = new Config(path.join(dir, 'config.json'));
  config.update({ telegram: { token: '123456789:YANLIS_ANAHTAR_abcdefghijklmnopqrstu', chatId: 0 } });
  const app = await createApp({ config, log: silent, lockfile: path.join(dir, 'yok', 'lockfile'), port: 0, host: '127.0.0.1', telegramApiBase: tg.url });
  t.after(async () => {
    await app.close();
    await tg.close();
  });
  await until(() => app.telegram.info().status === 'error', 'hata durumu');
  assert.match(app.telegram.info().error, /geçersiz/);
  // Biçimsiz anahtar reddedilir
  await assert.rejects(() => app.telegram.configure('olmaz'), /biçimi hatalı/);
});
