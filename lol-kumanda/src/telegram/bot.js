'use strict';
// İsteğe bağlı Telegram botu. Telefon kilitliyken bile bildirim almak için:
//   - Maç bulununca "Kabul et / Reddet" düğmeli mesaj
//   - Ban/seçim sırası sana gelince favori şampiyon düğmeleri
//   - Metin komutları: /kabul, /sec Ahri, /ban Yasuo, /sira, /durum …
// Bot, Telegram sunucusunu uzun yoklamayla (getUpdates) dinler; dışarıdan erişilebilir bir adres gerekmez.

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { resolveChampion } = require('../text');
const { UserError } = require('../game/actions');
const { PHASE_LABELS } = require('../game/state');

const DEFAULT_API = 'https://api.telegram.org';

const HELP = [
  '<b>Komutlar</b>',
  '/durum — anlık durum',
  '/kabul — bulunan maçı kabul et',
  '/reddet — bulunan maçı reddet',
  '/sira — sıraya gir · /iptal — sıradan çık',
  '/sec Ahri — şampiyon seç',
  '/ban Yasuo — şampiyon banla',
  '/otokabul — otomatik kabulü aç/kapat',
  '/link — telefon arayüzünün adresi',
  '',
  'Ban ya da seçim sırası sendeyken yalnızca şampiyonun adını yazman da yeter.',
].join('\n');

const COMMANDS = [
  { command: 'durum', description: 'Anlık durum' },
  { command: 'kabul', description: 'Bulunan maçı kabul et' },
  { command: 'reddet', description: 'Bulunan maçı reddet' },
  { command: 'sec', description: 'Şampiyon seç (örn. /sec Ahri)' },
  { command: 'ban', description: 'Şampiyon banla (örn. /ban Yasuo)' },
  { command: 'sira', description: 'Sıraya gir' },
  { command: 'iptal', description: 'Sıradan çık' },
  { command: 'otokabul', description: 'Otomatik kabulü aç/kapat' },
  { command: 'link', description: 'Telefon arayüzünün adresi' },
  { command: 'yardim', description: 'Yardım' },
];

class TelegramError extends Error {
  constructor(message, code = 0) {
    super(message);
    this.code = code;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
const stripHtml = (s) =>
  String(s)
    .replace(/<a href="([^"]*)">([^<]*)<\/a>/g, '$2: $1')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

class TelegramBot {
  constructor({ config, state, actions, log, getUrls = () => [], apiBase = DEFAULT_API }) {
    this.config = config;
    this.state = state;
    this.actions = actions;
    this.log = log;
    this.getUrls = getUrls;
    this.apiBase = apiBase || DEFAULT_API;
    this.autoAccept = null;
    this.status = 'off'; // off | checking | pairing | ready | error
    this.botName = '';
    this.pairCode = '';
    this.wrongCodes = 0;
    this.lastError = '';
    this.offset = 0;
    this.running = false;
    this.generation = 0;
    this.inflight = new Set();
    this.rcMessage = null;
    this.turnMessage = null;

    state.on('readyCheckStarted', (e) => this.guard(() => this.onReadyCheckStarted(e)));
    state.on('readyCheckEnded', (e) => this.guard(() => this.onReadyCheckEnded(e)));
    state.on('myTurnStarted', (e) => this.guard(() => this.onMyTurnStarted(e)));
    state.on('myTurnEnded', (e) => this.guard(() => this.onMyTurnEnded(e)));
    state.on('phase', (p, prev) => this.guard(() => this.onPhase(p, prev)));
  }

  get chatId() {
    return this.config.data.telegram.chatId;
  }

  get ready() {
    return this.running && this.status === 'ready' && Boolean(this.chatId);
  }

  info() {
    return {
      available: true,
      configured: Boolean(this.config.data.telegram.token),
      status: this.status,
      botName: this.botName,
      paired: Boolean(this.chatId),
      pairCode: this.status === 'pairing' ? this.pairCode : '',
      error: this.lastError,
    };
  }

  setStatus(s) {
    this.status = s;
    this.state.changed();
  }

  guard(fn) {
    if (!this.ready) return;
    Promise.resolve()
      .then(fn)
      .catch((e) => this.log.warn('Telegram bildirimi gönderilemedi:', e.message));
  }

  /* ---------- Telegram Bot API ---------- */

  call(method, params = {}, { timeoutMs = 15000 } = {}) {
    const url = new URL(`${this.apiBase}/bot${this.config.data.telegram.token}/${method}`);
    const body = Buffer.from(JSON.stringify(params));
    const mod = url.protocol === 'http:' ? http : https;
    return new Promise((resolve, reject) => {
      const req = mod.request(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
          timeout: timeoutMs,
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            this.inflight.delete(req);
            let data;
            try {
              data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            } catch (_) {
              reject(new TelegramError(`HTTP ${res.statusCode}`, res.statusCode));
              return;
            }
            if (data && data.ok) resolve(data.result);
            else reject(new TelegramError((data && data.description) || `HTTP ${res.statusCode}`, (data && data.error_code) || res.statusCode));
          });
        },
      );
      this.inflight.add(req);
      req.on('timeout', () => req.destroy(new Error('zaman aşımı')));
      req.on('error', (e) => {
        this.inflight.delete(req);
        reject(new TelegramError(e.message, 0));
      });
      req.end(body);
    });
  }

  async send(chatId, text, keyboard) {
    const params = { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
    if (keyboard) params.reply_markup = keyboard;
    try {
      return await this.call('sendMessage', params);
    } catch (e) {
      if (e.code !== 400) throw e;
      // Biçim ya da bağlantı reddedildiyse düz metinle tekrar dene
      const plain = { chat_id: chatId, text: stripHtml(text) };
      if (keyboard) plain.reply_markup = keyboard;
      return this.call('sendMessage', plain);
    }
  }

  reply(text, keyboard) {
    return this.send(this.chatId, text, keyboard);
  }

  async edit(messageId, text, keyboard) {
    const params = {
      chat_id: this.chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: keyboard || { inline_keyboard: [] },
    };
    try {
      await this.call('editMessageText', params);
    } catch (e) {
      if (!/not modified/i.test(e.message)) this.log.debug('Telegram mesajı düzenlenemedi:', e.message);
    }
  }

  /* ---------- yaşam döngüsü ---------- */

  start() {
    if (this.running) return;
    if (!this.config.data.telegram.token) {
      this.setStatus('off');
      return;
    }
    this.running = true;
    this.generation += 1;
    this.loop(this.generation);
  }

  stop() {
    this.running = false;
    this.generation += 1;
    for (const req of this.inflight) req.destroy();
    this.inflight.clear();
  }

  async loop(gen) {
    const alive = () => this.running && gen === this.generation;
    this.setStatus('checking');
    try {
      const me = await this.call('getMe');
      this.botName = me.username || me.first_name || '';
    } catch (e) {
      if (!alive()) return;
      if (e.code === 401 || e.code === 404) {
        this.lastError = 'Bot anahtarı (token) geçersiz.';
        this.log.warn('Telegram: bot anahtarı geçersiz.');
        this.running = false;
        this.setStatus('error');
        return;
      }
      this.lastError = `Telegram'a ulaşılamadı (${e.message}). Yeniden denenecek.`;
      this.setStatus('error');
      await sleep(15000);
      if (alive()) this.loop(gen);
      return;
    }
    if (!alive()) return;
    this.lastError = '';
    // Program kapalıyken birikmiş eski komutları atla
    try {
      const old = await this.call('getUpdates', { offset: -1, timeout: 0 });
      if (Array.isArray(old) && old.length) this.offset = old[old.length - 1].update_id + 1;
    } catch (_) {
      /* önemli değil */
    }
    this.call('setMyCommands', { commands: COMMANDS }).catch(() => {});
    if (this.chatId) {
      this.setStatus('ready');
      this.log.ok(`Telegram botu hazır (@${this.botName})`);
    } else {
      this.startPairing();
    }

    while (alive()) {
      try {
        const updates = await this.call(
          'getUpdates',
          { offset: this.offset, timeout: 50, allowed_updates: ['message', 'callback_query'] },
          { timeoutMs: 65000 },
        );
        for (const u of updates || []) {
          this.offset = Math.max(this.offset, u.update_id + 1);
          try {
            await this.handleUpdate(u);
          } catch (e) {
            this.log.warn('Telegram mesajı işlenemedi:', e.message);
          }
        }
        if (this.lastError) {
          this.lastError = '';
          this.state.changed();
        }
      } catch (e) {
        if (!alive()) return;
        if (e.code === 401 || e.code === 404) {
          this.lastError = 'Bot anahtarı (token) geçersiz.';
          this.running = false;
          this.setStatus('error');
          return;
        }
        this.lastError =
          e.code === 409 ? 'Bu bot başka bir programda da çalışıyor (ya da webhook tanımlı).' : `Bağlantı sorunu: ${e.message}`;
        this.state.changed();
        await sleep(5000);
      }
    }
  }

  startPairing() {
    this.pairCode = String(crypto.randomInt(100000, 1000000));
    this.wrongCodes = 0;
    this.setStatus('pairing');
    this.log.info(`Telegram eşleştirme: @${this.botName} botuna şu mesajı gönder →  /start ${this.pairCode}`);
  }

  /** Arayüzden bot anahtarı girildiğinde. Boş anahtar Telegram'ı kapatır. */
  async configure(rawToken) {
    const token = String(rawToken || '').trim();
    if (token && !/^\d{5,}:[\w-]{30,}$/.test(token)) {
      throw new UserError('Bot anahtarı biçimi hatalı. BotFather\'ın verdiği "123456789:AA…" biçimindeki anahtarı yapıştır.');
    }
    this.stop();
    const changed = token !== this.config.data.telegram.token;
    this.config.update({ telegram: { token, chatId: changed ? 0 : this.chatId } });
    this.botName = '';
    this.lastError = '';
    this.pairCode = '';
    if (!token) {
      this.setStatus('off');
      return { message: 'Telegram kapatıldı.' };
    }
    this.start();
    return { message: 'Telegram botu başlatılıyor…' };
  }

  async unpair() {
    this.config.update({ telegram: { ...this.config.data.telegram, chatId: 0 } });
    if (this.running && this.botName) this.startPairing();
    else this.state.changed();
    return { message: 'Eşleştirme kaldırıldı.' };
  }

  async sendTest() {
    if (!this.ready) throw new UserError('Telegram henüz eşleştirilmedi.', 409);
    await this.reply('👋 Test mesajı: LoL Kumanda bağlantısı çalışıyor.');
    return { message: 'Test mesajı gönderildi.' };
  }

  /* ---------- gelen mesajlar ---------- */

  async handleUpdate(u) {
    if (u.message) await this.onMessage(u.message);
    else if (u.callback_query) await this.onCallback(u.callback_query);
  }

  async onMessage(m) {
    const chat = m.chat || {};
    const text = String(m.text || '').trim();
    if (!chat.id || !text) return;
    if (!this.chatId) {
      const match = /^\/start(?:@\w+)?\s+(\d{6})$/.exec(text);
      if (match && chat.type === 'private' && this.pairCode && match[1] === this.pairCode) {
        this.config.update({ telegram: { ...this.config.data.telegram, chatId: chat.id } });
        this.pairCode = '';
        this.setStatus('ready');
        this.log.ok('Telegram eşleştirildi');
        await this.reply(`✅ <b>Eşleştirildi!</b>\nMaç bulunduğunda buradan haber vereceğim.\n\n${HELP}`);
        return;
      }
      if (match) {
        this.wrongCodes += 1;
        if (this.wrongCodes >= 5) {
          this.log.warn('Telegram: çok sayıda hatalı eşleştirme kodu; yeni kod üretildi.');
          this.startPairing();
        }
      }
      if (/^\/start/.test(text)) {
        await this.send(chat.id, 'Bu bot özeldir. Eşleştirmek için bilgisayardaki LoL Kumanda ekranında yazan kodu gönder:\n/start 123456').catch(() => {});
      }
      return;
    }
    if (chat.id !== this.chatId) return; // yabancı sohbetler yok sayılır
    await this.onCommand(text);
  }

  async onCommand(text) {
    const [head, ...rest] = text.split(/\s+/);
    const cmd = head.toLowerCase().replace(/@\w+$/, '');
    const arg = rest.join(' ').trim();
    switch (cmd) {
      case '/start':
      case '/yardim':
      case '/help':
        return this.reply(HELP);
      case '/durum':
        return this.reply(this.statusText());
      case '/kabul':
        return this.doAction('readyCheck.accept', {}, '✅ Maç kabul edildi.');
      case '/reddet':
        return this.doAction('readyCheck.decline', {}, '❌ Maç reddedildi.');
      case '/sira':
        return this.doAction('queue.start', {}, '🔎 Sıraya girildi.');
      case '/iptal':
        return this.doAction('queue.stop', {}, '⏹ Sıradan çıkıldı.');
      case '/otokabul':
        return this.toggleAutoAccept(arg);
      case '/sec':
      case '/seç':
        return this.chooseChampion(arg, 'pick');
      case '/ban':
        return this.chooseChampion(arg, 'ban');
      case '/link': {
        const url = this.getUrls()[0];
        return this.reply(url ? `🌐 Telefon arayüzü (aynı Wi-Fi'de):\n<a href="${esc(url)}">${esc(url)}</a>` : 'Yerel ağ adresi bulunamadı.');
      }
      default:
        break;
    }
    if (text.startsWith('/')) return this.reply('Bilinmeyen komut. /yardim yazabilirsin.');
    const cs = this.state.view().champSelect;
    if (cs && ['ban', 'pick', 'intent'].includes(cs.my.mode)) {
      return this.chooseChampion(text, cs.my.mode === 'ban' ? 'ban' : 'pick');
    }
    return this.reply('Komutları görmek için /yardim yaz.');
  }

  async doAction(type, params, okText) {
    try {
      const r = await this.actions.run(type, params);
      await this.reply(okText || esc(r.message));
    } catch (e) {
      await this.reply(`⚠️ ${esc(e.message)}`);
    }
  }

  async toggleAutoAccept(arg) {
    const a = arg.toLocaleLowerCase('tr');
    let on = !this.config.data.autoAccept;
    if (/^(ac|aç|on|1|evet)$/.test(a)) on = true;
    if (/^(kapat|kapa|off|0|hayir|hayır)$/.test(a)) on = false;
    this.config.update({ autoAccept: on });
    if (this.autoAccept) this.autoAccept.refresh();
    this.state.changed();
    await this.reply(on ? `⚡ Otomatik kabul <b>açık</b> (${this.config.data.autoAcceptDelaySec} sn gecikmeyle).` : '✋ Otomatik kabul <b>kapalı</b>.');
  }

  statusText() {
    const v = this.state.view();
    const lines = [];
    if (v.lcu.status !== 'connected') {
      lines.push('🔌 League istemcisi açık değil.');
    } else {
      lines.push(`📍 <b>${esc(PHASE_LABELS[v.phase] || v.phase)}</b>${v.queueName ? ` · ${esc(v.queueName)}` : ''}`);
      if (v.queue) lines.push(`⏱ Sırada: ${Math.round((Date.now() - v.queue.since) / 1000)} sn`);
      const cs = v.champSelect;
      if (cs) {
        if (cs.my.lockedChampionId) lines.push(`🔒 Seçimin: ${esc(this.state.championName(cs.my.lockedChampionId))}`);
        else if (cs.my.mode === 'ban') lines.push('🚫 Ban sırası sende.');
        else if (cs.my.mode === 'pick') lines.push('⭐ Seçim sırası sende.');
      }
      if (v.summoner && v.summoner.name) lines.push(`👤 ${esc(v.summoner.name)}`);
    }
    lines.push(`⚡ Otomatik kabul: ${this.config.data.autoAccept ? `açık (${this.config.data.autoAcceptDelaySec} sn)` : 'kapalı'}`);
    return lines.join('\n');
  }

  async chooseChampion(query, kind) {
    const cs = this.state.view().champSelect;
    if (!cs) return this.reply('Şu an şampiyon seçiminde değilsin.');
    if (!query) return this.reply(kind === 'ban' ? 'Kullanım: /ban Yasuo' : 'Kullanım: /sec Ahri');
    const mode = cs.my.mode;
    if (kind === 'ban' && mode !== 'ban') {
      return this.reply(mode === 'pick' || mode === 'intent' ? 'Şu an ban değil, seçim zamanı: /sec <isim>' : 'Şu an ban sıran değil.');
    }
    if (kind === 'pick' && mode !== 'pick' && mode !== 'intent') {
      return this.reply(mode === 'ban' ? 'Şu an ban sırası sende: /ban <isim>' : 'Şu an seçim yapamazsın.');
    }
    const { champion, candidates } = resolveChampion(query, this.state.statics.champions);
    const csId = this.state.cs.id;
    if (!champion) {
      if (!candidates.length) return this.reply(`"${esc(query)}" adında bir şampiyon bulamadım.`);
      const buttons = candidates.map((c) => ({ text: c.name, callback_data: `h:${csId}:${cs.my.actionId}:${c.id}` }));
      return this.reply('Hangisini kastettin?', { inline_keyboard: chunk(buttons, 3) });
    }
    return this.hoverAndConfirm(champion.id, cs.my.actionId, csId, null);
  }

  async hoverAndConfirm(championId, actionId, csId, messageId) {
    let text;
    let keyboard;
    try {
      const r = await this.actions.run('cs.hover', { championId, actionId, csId });
      const name = esc(this.state.championName(championId));
      if (r.intent) {
        text = `💭 Niyet olarak işaretlendi: <b>${name}</b>\nSıran gelince bildirim gelecek.`;
      } else {
        text = r.type === 'ban' ? `🚫 <b>${name}</b> işaretlendi. Banlansın mı?` : `⭐ <b>${name}</b> işaretlendi. Kilitlensin mi?`;
        keyboard = {
          inline_keyboard: [
            [
              { text: r.type === 'ban' ? '🚫 Banla' : '🔒 Kilitle', callback_data: `l:${csId}:${r.actionId}:${championId}` },
              { text: '↩️ Vazgeç', callback_data: 'x' },
            ],
          ],
        };
      }
    } catch (e) {
      text = `⚠️ ${esc(e.message)}`;
    }
    if (messageId) await this.edit(messageId, text, keyboard);
    else await this.reply(text, keyboard);
  }

  async onCallback(q) {
    const msg = q.message || {};
    const chatId = msg.chat && msg.chat.id;
    let toast = '';
    if (!this.chatId || chatId !== this.chatId) {
      await this.call('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
      return;
    }
    const [kind, ...parts] = String(q.data || '').split(':');
    try {
      if (kind === 'rc') {
        const [answer, rcId] = parts;
        const accept = answer === 'a';
        await this.actions.run(accept ? 'readyCheck.accept' : 'readyCheck.decline', { id: rcId });
        toast = accept ? 'Kabul edildi ✅' : 'Reddedildi';
        await this.edit(msg.message_id, accept ? '✅ <b>Maç kabul edildi.</b> Diğer oyuncular bekleniyor…' : '❌ <b>Maç reddedildi.</b>');
      } else if (kind === 'h') {
        const [csId, actionId, champId] = parts;
        await this.hoverAndConfirm(Number(champId), Number(actionId), csId, msg.message_id);
      } else if (kind === 'l') {
        const [csId, actionId, champId] = parts;
        const r = await this.actions.run('cs.lock', { championId: Number(champId), actionId: Number(actionId), csId });
        toast = r.message;
        await this.edit(msg.message_id, `${r.type === 'ban' ? '🚫' : '🔒'} <b>${esc(r.message)}</b>`);
      } else if (kind === 'q') {
        const r = await this.actions.run(parts[0] === 's' ? 'queue.start' : 'queue.stop');
        toast = r.message;
      } else if (kind === 'x') {
        await this.edit(msg.message_id, '↩️ Vazgeçildi. Başka bir şampiyon adı yazabilirsin.');
      }
    } catch (e) {
      toast = e.message;
    }
    await this.call('answerCallbackQuery', { callback_query_id: q.id, text: String(toast).slice(0, 190) }).catch(() => {});
  }

  /* ---------- bildirimler ---------- */

  async onReadyCheckStarted({ id }) {
    const v = this.state.view();
    const lines = ['🔔 <b>Maç bulundu!</b>'];
    if (v.queueName) lines.push(esc(v.queueName));
    if (this.config.data.autoAccept) lines.push(`⚡ ${this.config.data.autoAcceptDelaySec} sn içinde otomatik kabul edilecek.`);
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Kabul et', callback_data: `rc:a:${id}` },
          { text: '❌ Reddet', callback_data: `rc:d:${id}` },
        ],
      ],
    };
    const sent = await this.reply(lines.join('\n'), keyboard);
    this.rcMessage = { messageId: sent.message_id, rcId: id };
  }

  async onReadyCheckEnded({ id, response }) {
    const m = this.rcMessage;
    if (!m || m.rcId !== id) return;
    this.rcMessage = null;
    await sleep(1500); // oyun akışının yeni duruma geçmesini bekle
    const phase = this.state.raw.phase;
    let text;
    if (phase === 'ChampSelect' || this.state.raw.session) text = '🎮 <b>Maç başladı!</b> Şampiyon seçimine geçildi.';
    else if (response === 'Declined') text = '❌ Maç reddedildi.';
    else if (response === 'Accepted') text = phase === 'Matchmaking' ? '↩️ Bir oyuncu kabul etmedi; sıraya geri dönüldü.' : 'Maç iptal oldu.';
    else text = '⌛ Süre doldu; maç kabul edilmedi.';
    await this.edit(m.messageId, text);
  }

  async onMyTurnStarted({ actionId, type, csId }) {
    await sleep(350); // seçilebilir şampiyon listesinin tazelenmesini bekle
    const cs = this.state.view().champSelect;
    if (!cs || this.state.cs.id !== csId || cs.my.actionId !== actionId) return;
    const favs = this.config.data.favorites[type === 'ban' ? 'ban' : 'pick'] || [];
    const allowed = new Set(type === 'ban' ? cs.bannable : cs.pickable);
    const usable = favs.filter((fid) => !allowed.size || allowed.has(fid)).slice(0, 9);
    const buttons = usable.map((fid) => ({ text: this.state.championName(fid), callback_data: `h:${csId}:${actionId}:${fid}` }));
    const lines = [type === 'ban' ? '🚫 <b>Ban sırası sende!</b>' : '⭐ <b>Seçim sırası sende!</b>'];
    if (cs.timer.endsAt) lines.push(`⏱ ${Math.max(0, Math.round((cs.timer.endsAt - Date.now()) / 1000))} saniye`);
    lines.push(buttons.length ? 'Favorilerinden birine dokun ya da şampiyon adını yaz.' : 'Şampiyonun adını yaz (örn. <i>Ahri</i>).');
    const url = this.getUrls()[0];
    if (url) lines.push(`🌐 <a href="${esc(url)}">Telefon arayüzünü aç</a>`);
    const sent = await this.reply(lines.join('\n'), buttons.length ? { inline_keyboard: chunk(buttons, 3) } : undefined);
    this.turnMessage = { messageId: sent.message_id, actionId, csId };
  }

  async onMyTurnEnded({ actionId, csId, completed, championId, type }) {
    const m = this.turnMessage;
    if (!m || m.actionId !== actionId || m.csId !== csId) return;
    this.turnMessage = null;
    const name = championId ? esc(this.state.championName(championId)) : '';
    let text;
    if (completed) text = type === 'ban' ? `🚫 Banlandı: <b>${name || 'yok'}</b>` : `🔒 Kilitlendi: <b>${name}</b>`;
    else text = type === 'ban' ? '⌛ Ban sırası geçti.' : '⌛ Seçim sırası geçti.';
    await this.edit(m.messageId, text);
  }

  async onPhase(phase, prev) {
    if (phase === 'GameStart' && prev === 'ChampSelect') {
      await this.reply('🎮 <b>Oyun yükleniyor!</b> Bilgisayarın başına geç. İyi oyunlar!');
    } else if (prev === 'ChampSelect' && (phase === 'Lobby' || phase === 'Matchmaking' || phase === 'None')) {
      await this.reply(
        phase === 'Matchmaking'
          ? '⚠️ Şampiyon seçimi iptal oldu (biri çıktı). Sıraya geri dönüldü.'
          : '⚠️ Şampiyon seçimi iptal oldu.',
      );
    }
  }
}

module.exports = { TelegramBot, HELP, COMMANDS, stripHtml };
