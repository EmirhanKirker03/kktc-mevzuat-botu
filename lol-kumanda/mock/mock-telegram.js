'use strict';
// Sahte Telegram Bot API sunucusu: Telegram botunu internet olmadan test etmek için.

const http = require('http');

class MockTelegram {
  constructor({ token = '123456789:TEST_TOKEN_abcdefghijklmnopqrstuvwxyz', username = 'lolk_test_bot' } = {}) {
    this.token = token;
    this.username = username;
    this.updates = [];
    this.nextUpdateId = 1;
    this.nextMessageId = 100;
    this.sent = []; // sendMessage çağrıları
    this.edits = []; // editMessageText çağrıları
    this.answers = []; // answerCallbackQuery çağrıları
    this.calls = [];
    this.waiters = new Set();
  }

  async start() {
    this.server = http.createServer((req, res) => this.handle(req, res));
    await new Promise((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.port = this.server.address().port;
    this.url = `http://127.0.0.1:${this.port}`;
    return this;
  }

  close() {
    for (const w of this.waiters) w();
    this.waiters.clear();
    return new Promise((resolve) => {
      this.server.close(() => resolve());
      if (this.server.closeAllConnections) this.server.closeAllConnections();
    });
  }

  notify() {
    for (const w of this.waiters) w();
    this.waiters.clear();
  }

  pushUpdate(update) {
    this.updates.push({ update_id: this.nextUpdateId++, ...update });
    this.notify();
  }

  pushMessage(chatId, text, type = 'private') {
    this.pushUpdate({
      message: {
        message_id: this.nextMessageId++,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type },
        from: { id: chatId, is_bot: false, first_name: 'Test' },
        text,
      },
    });
  }

  pushCallback(chatId, messageId, data) {
    this.pushUpdate({
      callback_query: {
        id: String(Math.random()).slice(2),
        from: { id: chatId, is_bot: false, first_name: 'Test' },
        message: { message_id: messageId, chat: { id: chatId, type: 'private' }, date: Math.floor(Date.now() / 1000) },
        data,
      },
    });
  }

  /** Belirli bir koşulu sağlayan gönderilmiş mesajı bekler. */
  async waitForSent(pred, ms = 8000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const hit = this.sent.find(pred);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('Beklenen Telegram mesajı gönderilmedi');
  }

  async handle(req, res) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
    } catch (_) {
      body = {};
    }
    const m = /^\/bot([^/]+)\/(\w+)$/.exec(new URL(req.url, 'http://x').pathname);
    const send = (status, obj) => {
      const out = JSON.stringify(obj);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(out);
    };
    if (!m) return send(404, { ok: false, error_code: 404, description: 'Not Found' });
    if (m[1] !== this.token) return send(401, { ok: false, error_code: 401, description: 'Unauthorized' });
    const method = m[2];
    this.calls.push({ method, body });
    const ok = (result) => send(200, { ok: true, result });

    switch (method) {
      case 'getMe':
        return ok({ id: 999, is_bot: true, first_name: 'LoL Test', username: this.username });
      case 'setMyCommands':
        return ok(true);
      case 'getUpdates': {
        const offset = Number(body.offset) || 0;
        if (offset < 0) return ok(this.updates.slice(offset));
        this.updates = this.updates.filter((u) => u.update_id >= offset);
        if (!this.updates.length && body.timeout) {
          await new Promise((resolve) => {
            const done = () => {
              clearTimeout(t);
              resolve();
            };
            const t = setTimeout(() => {
              this.waiters.delete(done);
              resolve();
            }, Math.min(Number(body.timeout) * 1000, 1500));
            this.waiters.add(done);
          });
        }
        return ok(this.updates.filter((u) => u.update_id >= offset));
      }
      case 'sendMessage': {
        if (body.parse_mode === 'HTML' && /<(?!\/?(b|i|a|code)\b)[^>]*>/.test(body.text || '')) {
          return send(400, { ok: false, error_code: 400, description: "Bad Request: can't parse entities" });
        }
        const msg = { message_id: this.nextMessageId++, chat: { id: body.chat_id, type: 'private' }, date: Math.floor(Date.now() / 1000), text: body.text };
        this.sent.push({ ...body, message_id: msg.message_id });
        return ok(msg);
      }
      case 'editMessageText':
        this.edits.push(body);
        return ok({ message_id: body.message_id, text: body.text });
      case 'answerCallbackQuery':
        this.answers.push(body);
        return ok(true);
      default:
        return send(404, { ok: false, error_code: 404, description: 'Not Found: method not found' });
    }
  }
}

module.exports = { MockTelegram };
