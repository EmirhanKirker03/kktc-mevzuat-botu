'use strict';
// League istemcisi yerel API (LCU) bağlantısı: REST istekleri + WAMP olay akışı.
// İstemci kapanıp açıldığında kendiliğinden yeniden bağlanır.

const http = require('http');
const https = require('https');
const { EventEmitter } = require('events');
const WebSocket = require('ws');

class LcuError extends Error {
  constructor(message, status = 0, code = '') {
    super(message);
    this.name = 'LcuError';
    this.status = status;
    this.code = code;
  }
}

class LcuClient extends EventEmitter {
  constructor({ discovery, log }) {
    super();
    this.discovery = discovery;
    this.log = log;
    this.conn = null; // { port, protocol, auth, agent }
    this.ws = null;
    this.status = 'searching'; // searching | connecting | connected
    this.timer = null;
    this.stopped = true;
    this.busy = false;
    this.failed = null; // son başarısız bağlantı denemesi (aynı lockfile'ı her saniye denememek için)
  }

  get connected() {
    return this.status === 'connected';
  }

  start() {
    this.stopped = false;
    this.schedule(0);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    if (this.ws) {
      try {
        this.ws.terminate();
      } catch (_) {
        /* yoksay */
      }
    }
  }

  setStatus(s) {
    if (this.status !== s) {
      this.status = s;
      this.emit('status', s);
    }
  }

  schedule(ms) {
    clearTimeout(this.timer);
    if (!this.stopped) this.timer = setTimeout(() => this.tick(), ms);
  }

  async tick() {
    if (this.stopped || this.busy || this.status !== 'searching') return;
    this.busy = true;
    let creds = null;
    try {
      creds = await this.discovery.find();
    } catch (e) {
      this.log.debug('İstemci aranırken hata:', e);
    }
    this.busy = false;
    if (this.stopped) return;
    if (!creds) {
      this.schedule(2500);
      return;
    }
    const key = `${creds.port}:${creds.password}`;
    if (this.failed && this.failed.key === key && Date.now() - this.failed.at < 5000) {
      this.schedule(2500);
      return;
    }
    this.connect(creds, key);
  }

  connect(creds, key) {
    this.setStatus('connecting');
    const secure = creds.protocol !== 'http';
    const auth = `Basic ${Buffer.from(`riot:${creds.password}`).toString('base64')}`;
    // İstemcinin sertifikası Riot'un kendi imzaladığı yerel bir sertifikadır; yalnızca 127.0.0.1 için doğrulama kapalı.
    const agent = secure
      ? new https.Agent({ keepAlive: true, maxSockets: 12, rejectUnauthorized: false })
      : new http.Agent({ keepAlive: true, maxSockets: 12 });
    const url = `${secure ? 'wss' : 'ws'}://127.0.0.1:${creds.port}/`;
    const ws = new WebSocket(url, {
      headers: { Authorization: auth },
      rejectUnauthorized: false,
      perMessageDeflate: false,
      handshakeTimeout: 6000,
    });
    let opened = false;

    ws.on('open', () => {
      opened = true;
      this.failed = null;
      this.ws = ws;
      this.conn = { port: creds.port, protocol: secure ? 'https' : 'http', auth, agent, source: creds.source };
      // Tüm JSON API olaylarına abone ol; ilgilendiklerimizi uri'ye göre süzüyoruz.
      ws.send(JSON.stringify([5, 'OnJsonApiEvent']));
      this.setStatus('connected');
      this.log.ok(`League istemcisine bağlanıldı (port ${creds.port})`);
      this.emit('connected');
    });

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString('utf8'));
      } catch (_) {
        return;
      }
      if (Array.isArray(msg) && msg[0] === 8 && msg[2] && typeof msg[2] === 'object' && typeof msg[2].uri === 'string') {
        this.emit('event', msg[2]);
      }
    });

    ws.on('error', (e) => {
      this.log.debug('LCU websocket hatası:', e.message);
    });

    ws.on('close', () => {
      agent.destroy();
      if (this.ws === ws) this.ws = null;
      this.conn = null;
      if (opened) {
        this.log.warn('League istemcisi bağlantısı kapandı; yeniden aranıyor…');
        this.setStatus('searching');
        this.emit('disconnected');
        this.schedule(1500);
      } else {
        this.failed = { key, at: Date.now() };
        this.setStatus('searching');
        this.schedule(2500);
      }
    });
  }

  /** LCU'ya REST isteği. JSON döner; 204'te null. Hata durumunda LcuError fırlatır. */
  request(method, urlPath, body) {
    const conn = this.conn;
    if (!conn) return Promise.reject(new LcuError('League istemcisi açık değil.', 0, 'NOT_CONNECTED'));
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const mod = conn.protocol === 'https' ? https : http;
    return new Promise((resolve, reject) => {
      const req = mod.request(
        {
          host: '127.0.0.1',
          port: conn.port,
          path: urlPath,
          method,
          agent: conn.agent,
          timeout: 10000,
          headers: {
            Authorization: conn.auth,
            Accept: 'application/json',
            ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let parsed = null;
            if (text) {
              try {
                parsed = JSON.parse(text);
              } catch (_) {
                parsed = text;
              }
            }
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              const msg = parsed && typeof parsed === 'object' && parsed.message ? parsed.message : `HTTP ${res.statusCode}`;
              const code = parsed && typeof parsed === 'object' && parsed.errorCode ? parsed.errorCode : '';
              reject(new LcuError(msg, res.statusCode, code));
            }
          });
          res.on('error', (e) => reject(new LcuError(e.message, 0, 'NETWORK')));
        },
      );
      req.on('timeout', () => req.destroy(new Error('zaman aşımı')));
      req.on('error', (e) => reject(new LcuError(e.message, 0, 'NETWORK')));
      if (payload) req.write(payload);
      req.end();
    });
  }

  get(p) {
    return this.request('GET', p);
  }

  post(p, body) {
    return this.request('POST', p, body);
  }

  patch(p, body) {
    return this.request('PATCH', p, body);
  }

  put(p, body) {
    return this.request('PUT', p, body);
  }

  del(p) {
    return this.request('DELETE', p);
  }

  /** Görsel gibi ikili içerik indirir: { status, contentType, body }. */
  fetchRaw(urlPath) {
    const conn = this.conn;
    if (!conn) return Promise.reject(new LcuError('League istemcisi açık değil.', 0, 'NOT_CONNECTED'));
    const mod = conn.protocol === 'https' ? https : http;
    return new Promise((resolve, reject) => {
      const req = mod.request(
        {
          host: '127.0.0.1',
          port: conn.port,
          path: urlPath,
          method: 'GET',
          agent: conn.agent,
          timeout: 15000,
          headers: { Authorization: conn.auth },
        },
        (res) => {
          const chunks = [];
          let size = 0;
          res.on('data', (c) => {
            size += c.length;
            if (size > 5 * 1024 * 1024) req.destroy(new Error('dosya çok büyük'));
            else chunks.push(c);
          });
          res.on('end', () =>
            resolve({ status: res.statusCode, contentType: res.headers['content-type'] || '', body: Buffer.concat(chunks) }),
          );
          res.on('error', (e) => reject(new LcuError(e.message, 0, 'NETWORK')));
        },
      );
      req.on('timeout', () => req.destroy(new Error('zaman aşımı')));
      req.on('error', (e) => reject(new LcuError(e.message, 0, 'NETWORK')));
      req.end();
    });
  }
}

module.exports = { LcuClient, LcuError };
