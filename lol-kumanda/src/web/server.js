'use strict';
// Telefonun bağlandığı yerel web sunucusu:
//   - arayüz dosyaları (public/)
//   - /api/events  : anlık durum akışı (Server-Sent Events)
//   - /api/action  : kabul, seçim, ban vb. komutlar
//   - /lcu-asset/* : şampiyon/büyü görselleri (istemciden vekil olarak)
//   - /qr          : yalnızca bilgisayardan açılan QR sayfası

const http = require('http');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { tokensEqual } = require('../config');
const { toSvg } = require('../qr');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const CSP =
  "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; " +
  "base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.userFacing = true;
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '');
    if (!type.includes('application/json')) {
      reject(new HttpError(415, 'JSON bekleniyor.'));
      return;
    }
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'İstek çok büyük.'));
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (_) {
        reject(new HttpError(400, 'Geçersiz JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function isLoopback(addr) {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

/** DNS yeniden bağlama saldırılarına karşı yalnızca IP, localhost ve bu bilgisayarın adı kabul edilir. */
function hostAllowed(hostHeader) {
  if (!hostHeader) return true;
  let host = String(hostHeader).trim().toLowerCase();
  if (host.startsWith('[')) host = host.slice(1, host.indexOf(']'));
  else host = host.replace(/:\d+$/, '');
  if (net.isIP(host)) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  const me = os.hostname().toLowerCase();
  return host === me || host === `${me}.local` || host === `${me}.lan` || host === `${me}.home`;
}

function etagOf(buf) {
  return `"${crypto.createHash('sha1').update(buf).digest('base64').slice(0, 20)}"`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function createWebServer({
  config,
  state,
  actions,
  lcu,
  log,
  telegram = null,
  autoAccept = null,
  version = '0.0.0',
  getUrls = () => [],
  publicDir = path.join(__dirname, '..', '..', 'public'),
  embedded = null,
}) {
  const clients = new Set();
  const assetCache = new Map();
  let assetBytes = 0;
  const ASSET_LIMIT = 80 * 1024 * 1024;

  function viewPayload() {
    const v = state.view();
    v.app = { version };
    v.settings = { autoAccept: config.data.autoAccept, autoAcceptDelaySec: config.data.autoAcceptDelaySec };
    v.favorites = config.data.favorites;
    v.telegram = telegram ? telegram.info() : { available: false };
    return v;
  }

  let broadcastTimer = null;
  function broadcast() {
    if (broadcastTimer) return;
    broadcastTimer = setTimeout(() => {
      broadcastTimer = null;
      if (!clients.size) return;
      const chunk = `event: state\ndata: ${JSON.stringify(viewPayload())}\n\n`;
      for (const res of clients) res.write(chunk);
    }, 25);
  }
  state.on('change', broadcast);

  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(': ping\n\n');
  }, 15000);

  function authorized(req, url) {
    if (!config.data.requireToken) return true;
    const t = req.headers['x-lolk-token'] || url.searchParams.get('t') || '';
    return tokensEqual(t, config.data.token);
  }

  /* ---------- statik dosyalar ---------- */

  function loadStatic(rel) {
    if (embedded) {
      const e = embedded[rel.replace(/^\//, '')];
      return e ? Buffer.from(e, 'base64') : null;
    }
    const abs = path.resolve(publicDir, `.${rel}`);
    if (!abs.startsWith(path.resolve(publicDir) + path.sep)) return null;
    try {
      return fs.readFileSync(abs);
    } catch (_) {
      return null;
    }
  }

  function serveStatic(req, res, pathname) {
    let rel = pathname === '/' ? '/index.html' : pathname;
    try {
      rel = decodeURIComponent(rel);
    } catch (_) {
      sendText(res, 400, 'Geçersiz adres');
      return;
    }
    if (rel.includes('\0') || rel.includes('..')) {
      sendText(res, 400, 'Geçersiz adres');
      return;
    }
    const body = loadStatic(rel);
    if (!body) {
      sendText(res, 404, 'Bulunamadı');
      return;
    }
    const ext = path.extname(rel).toLowerCase();
    const etag = etagOf(body);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      ETag: etag,
      'Cache-Control': rel.startsWith('/icons/') ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    };
    if (ext === '.html') headers['Content-Security-Policy'] = CSP;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  /* ---------- istemci görselleri ---------- */

  function sendAsset(req, res, item) {
    const headers = {
      'Content-Type': item.type,
      ETag: item.etag,
      'Cache-Control': 'public, max-age=604800',
      'X-Content-Type-Options': 'nosniff',
    };
    if (req.headers['if-none-match'] === item.etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    headers['Content-Length'] = item.body.length;
    res.writeHead(200, headers);
    res.end(item.body);
  }

  async function proxyAsset(req, res, pathname) {
    let lcuPath;
    try {
      lcuPath = decodeURIComponent(pathname.slice('/lcu-asset'.length));
    } catch (_) {
      sendText(res, 400, 'Geçersiz adres');
      return;
    }
    if (!lcuPath.startsWith('/lol-game-data/assets/') || lcuPath.includes('..') || /[\0\\?#]/.test(lcuPath)) {
      sendText(res, 400, 'Geçersiz adres');
      return;
    }
    const key = lcuPath.toLowerCase();
    const hit = assetCache.get(key);
    if (hit) {
      sendAsset(req, res, hit);
      return;
    }
    if (!lcu.connected) {
      res.writeHead(503, { 'Cache-Control': 'no-store', 'Retry-After': '5' });
      res.end();
      return;
    }
    let r;
    try {
      r = await lcu.fetchRaw(encodeURI(lcuPath));
    } catch (e) {
      res.writeHead(502, { 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    if (r.status !== 200 || !r.body.length) {
      res.writeHead(404, { 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    const ext = path.extname(lcuPath).toLowerCase();
    const type = /^image\//.test(r.contentType) ? r.contentType : MIME[ext] || 'application/octet-stream';
    const item = { type, body: r.body, etag: etagOf(r.body) };
    assetCache.set(key, item);
    assetBytes += r.body.length;
    while (assetBytes > ASSET_LIMIT && assetCache.size) {
      const [oldKey, old] = assetCache.entries().next().value;
      assetCache.delete(oldKey);
      assetBytes -= old.body.length;
    }
    sendAsset(req, res, item);
  }

  /* ---------- QR sayfası ---------- */

  function qrPage(req, res) {
    if (!isLoopback(req.socket.remoteAddress)) {
      sendText(res, 403, 'Bu sayfa yalnızca bilgisayarın kendisinden açılabilir.');
      return;
    }
    const urls = getUrls();
    const main = urls[0];
    const others = urls.slice(1);
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LoL Kumanda — Telefonu bağla</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#010a13;color:#f0e6d2;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:560px;padding:32px 20px;text-align:center}
h1{font-size:22px;letter-spacing:.08em;text-transform:uppercase;color:#c8aa6e;margin:0 0 8px}
.qr{display:inline-block;padding:14px;background:#fff;border-radius:12px;margin:18px 0;box-shadow:0 0 0 2px #c8aa6e}
code{display:block;padding:10px 12px;background:#0a1428;border:1px solid #463714;border-radius:8px;color:#f0e6d2;word-break:break-all;font-size:15px}
ol{text-align:left;color:#a09b8c;padding-left:22px}
.muted{color:#a09b8c;font-size:14px}
</style></head><body><main>
<h1>Telefonu bağla</h1>
${
  main
    ? `<p>Telefonun bilgisayarla <b>aynı Wi-Fi ağında</b> olsun. Kamerayla QR kodu tara:</p>
<div class="qr">${toSvg(main, { size: 280 })}</div>
<code>${escapeHtml(main)}</code>
${others.length ? `<p class="muted">Açılmazsa şunları dene:</p>${others.map((u) => `<code>${escapeHtml(u)}</code>`).join('<br>')}` : ''}`
    : '<p>Bilgisayarda bir yerel ağ bağlantısı bulunamadı. Wi-Fi ya da kabloyla ağa bağlanıp programı yeniden başlat.</p>'
}
<ol>
<li>Açılan sayfayı tarayıcıda <b>Ana ekrana ekle</b> ile uygulama gibi kullanabilirsin.</li>
<li>Telefon bağlanamazsa Windows Güvenlik Duvarı'nın Node.js'e izin verdiğinden emin ol (README → Sorun giderme).</li>
<li>Erişim anahtarı: <b>${escapeHtml(config.data.token)}</b> (bu adresi kimseyle paylaşma).</li>
</ol>
</main></body></html>`;
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      'Referrer-Policy': 'no-referrer',
    });
    res.end(html);
  }

  /* ---------- API ---------- */

  function sse(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true, 10000);
    res.write('retry: 2000\n\n');
    res.write(`event: state\ndata: ${JSON.stringify(viewPayload())}\n\n`);
    clients.add(res);
    const done = () => clients.delete(res);
    req.on('close', done);
    res.on('error', done);
  }

  async function handleSettings(body) {
    const patch = {};
    if (typeof body.autoAccept === 'boolean') patch.autoAccept = body.autoAccept;
    if (body.autoAcceptDelaySec !== undefined) {
      const d = Number(body.autoAcceptDelaySec);
      if (!Number.isFinite(d)) throw new HttpError(400, 'Geçersiz gecikme.');
      patch.autoAcceptDelaySec = d;
    }
    config.update(patch);
    if (autoAccept) autoAccept.refresh();
    if (patch.autoAccept !== undefined) log.info(`Otomatik kabul ${patch.autoAccept ? 'açıldı' : 'kapatıldı'}`);
    state.changed();
    return { ok: true, message: 'Ayarlar kaydedildi.' };
  }

  async function handleFavorites(body) {
    const mode = body.mode === 'ban' ? 'ban' : 'pick';
    const id = Number(body.championId);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Geçersiz şampiyon.');
    const list = config.data.favorites[mode].filter((x) => x !== id);
    if (body.on) list.push(id);
    if (list.length > 40) throw new HttpError(400, 'En fazla 40 favori eklenebilir.');
    config.update({ favorites: { ...config.data.favorites, [mode]: list } });
    state.changed();
    return { ok: true, favorites: config.data.favorites };
  }

  async function handleTelegram(body) {
    if (!telegram) throw new HttpError(404, 'Telegram desteği yok.');
    if (body.unpair) return { ok: true, ...(await telegram.unpair()) };
    if (body.test) return { ok: true, ...(await telegram.sendTest()) };
    if (typeof body.token === 'string') return { ok: true, ...(await telegram.configure(body.token)) };
    throw new HttpError(400, 'Eksik bilgi.');
  }

  async function api(req, res, url) {
    const p = url.pathname;
    if (p === '/api/hello' && req.method === 'GET') {
      sendJson(res, 200, {
        app: 'lol-kumanda',
        version,
        authRequired: config.data.requireToken,
        authorized: authorized(req, url),
      });
      return;
    }
    if (!authorized(req, url)) {
      sendJson(res, 401, { error: 'Erişim anahtarı geçersiz. Bilgisayardaki QR kodu yeniden tara.' });
      return;
    }
    if (req.method === 'GET') {
      if (p === '/api/events') return sse(req, res);
      if (p === '/api/state') return sendJson(res, 200, viewPayload());
      if (p === '/api/static') return sendJson(res, 200, state.staticsPayload());
      sendJson(res, 404, { error: 'Bulunamadı.' });
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Yöntem desteklenmiyor.' });
      return;
    }
    const body = await readJson(req);
    let result;
    if (p === '/api/action') result = { ok: true, ...(await actions.run(String(body.type || ''), body.params || {})) };
    else if (p === '/api/settings') result = await handleSettings(body);
    else if (p === '/api/favorites') result = await handleFavorites(body);
    else if (p === '/api/telegram') result = await handleTelegram(body);
    else throw new HttpError(404, 'Bulunamadı.');
    sendJson(res, 200, result);
  }

  async function handler(req, res) {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch (_) {
      sendText(res, 400, 'Geçersiz adres');
      return;
    }
    if (!hostAllowed(req.headers.host)) {
      sendText(res, 403, 'Bu adresle erişilemez. Bilgisayarın IP adresini kullan.');
      return;
    }
    const p = url.pathname;
    try {
      if (p.startsWith('/api/')) await api(req, res, url);
      else if (req.method !== 'GET' && req.method !== 'HEAD') sendText(res, 405, 'Yöntem desteklenmiyor');
      else if (p.startsWith('/lcu-asset/')) await proxyAsset(req, res, p);
      else if (p === '/qr') qrPage(req, res);
      else serveStatic(req, res, p);
    } catch (e) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (e && e.userFacing) {
        sendJson(res, e.status || 400, { error: e.message });
      } else {
        log.error('Sunucu hatası:', e && e.stack ? e.stack : e);
        sendJson(res, 500, { error: 'Beklenmeyen bir hata oluştu.' });
      }
    }
  }

  const server = http.createServer(handler);
  server.keepAliveTimeout = 65000;

  return {
    server,
    clients,
    broadcast,
    listen(port, host = '0.0.0.0') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve(server.address().port);
        });
      });
    },
    close() {
      clearInterval(heartbeat);
      clearTimeout(broadcastTimer);
      state.off('change', broadcast);
      for (const res of clients) res.end();
      clients.clear();
      return new Promise((resolve) => {
        server.close(() => resolve());
        if (server.closeAllConnections) server.closeAllConnections();
      });
    },
  };
}

module.exports = { createWebServer, hostAllowed, isLoopback, HttpError };
