'use strict';
// Sunucu + sahte League istemcisi: yetki, canlı akış, görsel vekili, otomatik kabul,
// istemcinin kapanıp açılması ve HTTPS (gerçek istemci gibi) bağlantı.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { startMockLcu } = require('../mock/mock-lcu');
const { createApp } = require('../src/app');
const { Config } = require('../src/config');
const { silent } = require('../src/log');

const FAST = { queue: 300, settle: 150, planning: 600, ban: 4000, reveal: 200, pick: 2500, finalization: 1500, gameStarting: 200, game: 500 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, label, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await pred();
    if (v) return v;
    await sleep(40);
  }
  throw new Error(`zaman aşımı: ${label}`);
}

async function setup(t, { mockOpts = {}, cfg = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lolk-int-'));
  const mock = await startMockLcu({ fetchIcons: false, timings: FAST, lockfileDir: dir, ...mockOpts });
  const config = new Config(path.join(dir, 'config.json'));
  if (Object.keys(cfg).length) config.update(cfg);
  const app = await createApp({ config, log: silent, lockfile: mock.lockfile, port: 0, host: '127.0.0.1', pollMs: 300, telegram: false });
  const ctx = { dir, mock, config, app, base: `http://127.0.0.1:${app.port}` };
  ctx.req = async (p, { method = 'GET', body, token = config.data.token, headers = {} } = {}) => {
    const res = await fetch(`${ctx.base}${p}`, {
      method,
      headers: { ...(token ? { 'X-Lolk-Token': token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const type = res.headers.get('content-type') || '';
    return { status: res.status, headers: res.headers, body: type.includes('json') ? await res.json() : await res.text() };
  };
  ctx.action = (type, params = {}) => ctx.req('/api/action', { method: 'POST', body: { type, params } });
  ctx.view = async () => (await ctx.req('/api/state')).body;
  t.after(async () => {
    await app.close();
    await ctx.mock.close().catch(() => {});
  });
  await until(() => app.state.raw.phase === 'Lobby' && app.state.statics.loaded, 'bağlantı');
  return ctx;
}

test('yetki: anahtarsız istek reddedilir, anahtarla kabul edilir', async (t) => {
  const c = await setup(t);
  assert.strictEqual((await c.req('/api/state', { token: '' })).status, 401);
  assert.strictEqual((await c.req('/api/state', { token: 'yanlis-anahtar-0' })).status, 401);
  const hello = await c.req('/api/hello', { token: '' });
  assert.deepStrictEqual([hello.body.authRequired, hello.body.authorized], [true, false]);
  const ok = await c.req('/api/state');
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.lcu.status, 'connected');
  // Anahtar sorgu parametresiyle ve büyük harfle de geçerli
  const q = await c.req(`/api/state?t=${c.config.data.token.toUpperCase()}`, { token: '' });
  assert.strictEqual(q.status, 200);
  // Yanlış içerik türü
  const bad = await c.req('/api/action', { method: 'POST', headers: { 'Content-Type': 'text/plain' } });
  assert.strictEqual(bad.status, 415);
  // Bilinmeyen işlem
  assert.strictEqual((await c.action('yok.boyle')).status, 400);
});

test('statik dosyalar, güvenlik başlıkları, görsel vekili ve QR sayfası', async (t) => {
  const c = await setup(t);
  const index = await c.req('/', { token: '' });
  assert.strictEqual(index.status, 200);
  assert.match(index.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(index.body, /LoL Kumanda/);
  assert.strictEqual((await c.req('/app.js', { token: '' })).status, 200);
  assert.strictEqual((await c.req('/manifest.webmanifest', { token: '' })).status, 200);
  assert.notStrictEqual((await c.req('/..%2fpackage.json', { token: '' })).status, 200);
  assert.strictEqual((await c.req('/yok.html', { token: '' })).status, 404);

  const icon = await fetch(`${c.base}/lcu-asset/lol-game-data/assets/v1/champion-icons/103.png`);
  assert.strictEqual(icon.status, 200);
  assert.match(icon.headers.get('content-type'), /^image\//);
  const etag = icon.headers.get('etag');
  const again = await fetch(`${c.base}/lcu-asset/lol-game-data/assets/v1/champion-icons/103.png`, { headers: { 'If-None-Match': etag } });
  assert.strictEqual(again.status, 304);
  assert.strictEqual((await fetch(`${c.base}/lcu-asset/lol-summoner/v1/current-summoner`)).status, 400);
  assert.strictEqual((await fetch(`${c.base}/lcu-asset/lol-game-data/assets/../../lol-summoner/v1/current-summoner`)).status, 400);

  const qr = await c.req('/qr', { token: '' });
  assert.strictEqual(qr.status, 200);
  assert.match(qr.body, /<svg/);

  // Yabancı alan adıyla gelen istek (DNS rebinding) reddedilir
  const evil = await new Promise((resolve) => {
    http.get({ host: '127.0.0.1', port: c.app.port, path: '/qr', headers: { Host: 'kotu-site.com' } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
  });
  assert.strictEqual(evil, 403);

  const st = await c.req('/api/static');
  assert.ok(st.body.champions.length > 150);
  const ahri = st.body.champions.find((x) => x.id === 103);
  assert.strictEqual(ahri.icon, '/lcu-asset/lol-game-data/assets/v1/champion-icons/103.png');
  assert.ok(st.body.spells.every((s) => !/placeholder/i.test(s.name)));
});

test('canlı akış (SSE) durum değişikliklerini iletir', async (t) => {
  const c = await setup(t);
  const states = [];
  const ac = new AbortController();
  t.after(() => ac.abort());
  const res = await fetch(`${c.base}/api/events?t=${c.config.data.token}`, { signal: ac.signal });
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  (async () => {
    const dec = new TextDecoder();
    let buf = '';
    try {
      for await (const chunk of res.body) {
        buf += dec.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const data = block.split('\n').find((l) => l.startsWith('data: '));
          if (data) states.push(JSON.parse(data.slice(6)));
        }
      }
    } catch (_) {
      /* iptal */
    }
  })();
  await until(() => states.length, 'ilk durum');
  assert.strictEqual(states[0].phase, 'Lobby');
  await c.action('queue.start');
  await until(() => states.some((s) => s.phase === 'Matchmaking'), 'sırada olayı');
  await until(() => states.some((s) => s.readyCheck && s.readyCheck.state === 'InProgress'), 'maç bulundu olayı');
  const declined = await c.action('readyCheck.decline', {});
  assert.strictEqual(declined.status, 200);
  await until(() => states[states.length - 1].phase === 'Lobby', 'lobiye dönüş');
});

test('otomatik kabul ve süre dolunca dodge', async (t) => {
  const c = await setup(t, { cfg: { autoAccept: true, autoAcceptDelaySec: 0 } });
  await c.action('queue.start');
  await until(() => c.mock.calls.some((x) => x.path === '/lol-matchmaking/v1/ready-check/accept'), 'otomatik kabul');
  await until(() => c.app.state.raw.session, 'seçim ekranı');
  // Hiçbir şey yapmadan seçim süresinin dolmasını bekle → sahte istemci lobiye döner
  await until(() => c.app.state.raw.phase === 'Lobby' && !c.app.state.raw.session, 'dodge', 30000);
  const v = await c.view();
  assert.strictEqual(v.champSelect, null);
});

test('sıra bende değilken kilitleme ve eski eylem kimliği reddedilir', async (t) => {
  const c = await setup(t);
  await c.action('queue.start');
  const rc = await until(async () => (await c.view()).readyCheck, 'maç bulundu');
  assert.strictEqual((await c.action('readyCheck.accept', { id: 'eski' })).status, 409);
  assert.strictEqual((await c.action('readyCheck.accept', { id: rc.id })).status, 200);
  const v = await until(async () => {
    const x = await c.view();
    return x.champSelect && x.champSelect.my.mode === 'intent' ? x : null;
  }, 'planlama');
  const notYet = await c.action('cs.lock', { championId: 103, actionId: v.champSelect.my.actionId });
  assert.strictEqual(notYet.status, 409);
  assert.match(notYet.body.error, /henüz gelmedi/);
  const stale = await c.action('cs.hover', { championId: 103, actionId: 9999 });
  assert.strictEqual(stale.status, 409);
  const bad = await c.action('cs.hover', { championId: -1 });
  assert.strictEqual(bad.status, 400);
});

test('League istemcisi kapanıp yeniden açılınca kendiliğinden bağlanır', async (t) => {
  const c = await setup(t);
  await c.mock.simulateClientExit();
  await until(() => c.app.lcu.status !== 'connected', 'bağlantı koptu');
  const v = await c.view();
  assert.notStrictEqual(v.lcu.status, 'connected');
  assert.strictEqual(v.phase, 'None');
  assert.strictEqual((await c.action('queue.start')).status, 503);
  // Aynı klasörde yeni bir istemci (yeni port ve şifre) açılır
  c.mock = await startMockLcu({ fetchIcons: false, timings: FAST, lockfileDir: c.dir });
  await until(() => c.app.lcu.status === 'connected' && c.app.state.raw.phase === 'Lobby', 'yeniden bağlandı', 20000);
});

function makeCert(dir) {
  try {
    execFileSync(
      'openssl',
      ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem'), '-days', '1', '-subj', '/CN=127.0.0.1'],
      { stdio: 'ignore' },
    );
    return { key: fs.readFileSync(path.join(dir, 'key.pem')), cert: fs.readFileSync(path.join(dir, 'cert.pem')) };
  } catch (_) {
    return null;
  }
}

test('HTTPS + WSS (gerçek istemci gibi kendinden imzalı sertifika)', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lolk-tls-'));
  const tls = makeCert(dir);
  if (!tls) {
    t.skip('openssl yok');
    return;
  }
  const c = await setup(t, { mockOpts: { tls } });
  assert.match(fs.readFileSync(c.mock.lockfile, 'utf8'), /:https$/);
  await c.action('queue.start');
  await until(() => c.app.state.raw.readyCheck, 'websocket olayı (wss)');
});
