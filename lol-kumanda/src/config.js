'use strict';
// Ayarlar config.json dosyasında tutulur; dosya ilk çalıştırmada oluşturulur.
// Ortam değişkeni LOLK_CONFIG ile başka bir dosya gösterilebilir.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** Uygulamanın klasörü: tek dosya .exe olarak çalışıyorsa exe'nin klasörü, yoksa proje kökü. */
function appDir() {
  try {
    // eslint-disable-next-line global-require
    const sea = require('node:sea');
    if (sea.isSea()) return path.dirname(process.execPath);
  } catch (_) {
    /* node:sea yok (eski Node) */
  }
  return path.resolve(__dirname, '..');
}

const DEFAULTS = Object.freeze({
  port: 4747,
  // Telefonun bağlanması için erişim anahtarı (boşsa üretilir)
  token: '',
  requireToken: true,
  // Maç bulununca otomatik kabul
  autoAccept: false,
  autoAcceptDelaySec: 2,
  // League kurulum klasörü (boşsa otomatik bulunur)
  leaguePath: '',
  favorites: { pick: [], ban: [] },
  telegram: { token: '', chatId: 0 },
});

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // karışan harfler (i, l, o, 0, 1) yok

function generateToken() {
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    if (i && i % 4 === 0) out += '-';
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Karşılaştırma için anahtarı sadeleştirir: küçük harf, yalnız harf ve rakam. */
function normalizeToken(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function tokensEqual(a, b) {
  const x = Buffer.from(normalizeToken(a));
  const y = Buffer.from(normalizeToken(b));
  if (!x.length || x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

function uniqueIds(list) {
  const out = [];
  for (const v of Array.isArray(list) ? list : []) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

function sanitize(raw) {
  const d = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
  d.port = Number.isInteger(Number(d.port)) && Number(d.port) > 0 && Number(d.port) < 65536 ? Number(d.port) : DEFAULTS.port;
  d.token = typeof d.token === 'string' ? d.token.trim() : '';
  d.requireToken = d.requireToken !== false;
  d.autoAccept = d.autoAccept === true;
  const delay = Number(d.autoAcceptDelaySec);
  d.autoAcceptDelaySec = Number.isFinite(delay) ? Math.min(10, Math.max(0, delay)) : DEFAULTS.autoAcceptDelaySec;
  d.leaguePath = typeof d.leaguePath === 'string' ? d.leaguePath : '';
  const fav = d.favorites && typeof d.favorites === 'object' ? d.favorites : {};
  d.favorites = { pick: uniqueIds(fav.pick), ban: uniqueIds(fav.ban) };
  const tg = d.telegram && typeof d.telegram === 'object' ? d.telegram : {};
  d.telegram = {
    token: typeof tg.token === 'string' ? tg.token.trim() : '',
    chatId: Number.isFinite(Number(tg.chatId)) ? Number(tg.chatId) : 0,
  };
  return d;
}

class Config {
  constructor(file) {
    this.file = file || process.env.LOLK_CONFIG || path.join(appDir(), 'config.json');
    this.isNew = false;
    this.data = this.load();
  }

  load() {
    let raw = null;
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8').replace(/^﻿/, ''));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        // Bozuk dosyayı yedekleyip baştan başla
        try {
          fs.renameSync(this.file, `${this.file}.bozuk-${Date.now()}`);
        } catch (_) {
          /* yoksay */
        }
      }
      this.isNew = true;
    }
    const data = sanitize(raw);
    let dirty = this.isNew;
    if (!data.token) {
      data.token = generateToken();
      dirty = true;
    }
    this.data = data;
    if (dirty) this.save();
    return data;
  }

  save() {
    const tmp = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmp, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
      fs.renameSync(tmp, this.file);
    } catch (e) {
      // Yazılamıyorsa (salt okunur klasör) ayarlar yalnızca bellekte kalır
      this.saveError = e;
    }
  }

  /** Üst düzey alanları birleştirir ve kaydeder. */
  update(patch) {
    this.data = sanitize({ ...this.data, ...patch });
    this.save();
    return this.data;
  }
}

module.exports = { Config, DEFAULTS, generateToken, normalizeToken, tokensEqual, appDir, sanitize };
