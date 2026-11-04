'use strict';
// Tüm parçaları bir araya getirir. main.js (komut satırı) ve testler bunu kullanır.

const { Discovery } = require('./lcu/discovery');
const { LcuClient } = require('./lcu/client');
const { GameState } = require('./game/state');
const { Actions } = require('./game/actions');
const { setupAutoAccept } = require('./game/auto-accept');
const { createWebServer } = require('./web/server');
const { TelegramBot } = require('./telegram/bot');
const { lanAddresses } = require('./network');
const pkg = require('../package.json');

/**
 * @param {object} o
 * @param {import('./config').Config} o.config
 * @param {object} o.log
 * @param {string} [o.lockfile]        doğrudan lockfile (demo/test)
 * @param {string} [o.leaguePath]      kurulum klasörü
 * @param {number} [o.port]            0 = rastgele boş port
 * @param {string} [o.host]
 * @param {number} [o.pollMs]
 * @param {string} [o.telegramApiBase] test için sahte Telegram adresi
 * @param {boolean} [o.telegram=true]
 * @param {object} [o.embedded]        tek dosya .exe için gömülü arayüz dosyaları
 */
async function createApp({
  config,
  log,
  lockfile = '',
  leaguePath = '',
  port = config.data.port,
  host = '0.0.0.0',
  pollMs = 2000,
  telegramApiBase,
  telegram: telegramEnabled = true,
  // Tek dosya .exe sürümünde arayüz dosyaları paketin içine gömülüdür (scripts/build-exe.js)
  embedded = globalThis.__LOLK_EMBEDDED__ || null,
  publicDir,
}) {
  const discovery = new Discovery({ lockfile, leaguePath, log });
  const lcu = new LcuClient({ discovery, log });
  const state = new GameState({ lcu, log, pollMs });
  const actions = new Actions({ lcu, state, config, log });
  const autoAccept = setupAutoAccept({ state, actions, config, log });

  let urls = [];
  const getUrls = () => urls;
  const telegram = telegramEnabled
    ? new TelegramBot({ config, state, actions, log, getUrls, apiBase: telegramApiBase })
    : null;
  if (telegram) telegram.autoAccept = autoAccept;

  const web = createWebServer({
    config,
    state,
    actions,
    lcu,
    log,
    telegram,
    autoAccept,
    version: pkg.version,
    getUrls,
    embedded,
    ...(publicDir ? { publicDir } : {}),
  });
  const actualPort = await web.listen(port, host);
  const query = config.data.requireToken ? `?t=${config.data.token}` : '';
  urls = lanAddresses().map((a) => `http://${a.address}:${actualPort}/${query}`);

  state.start();
  lcu.start();
  if (telegram) telegram.start();

  return {
    config,
    lcu,
    state,
    actions,
    web,
    telegram,
    autoAccept,
    port: actualPort,
    getUrls,
    localUrl: `http://localhost:${actualPort}/${query}`,
    async close() {
      if (telegram) telegram.stop();
      lcu.stop();
      state.stop();
      await web.close();
    },
  };
}

module.exports = { createApp };
