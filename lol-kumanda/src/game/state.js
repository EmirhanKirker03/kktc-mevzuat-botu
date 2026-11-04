'use strict';
// İstemcinin anlık durumunu tutar: oyun akışı, kabul penceresi, sıra, lobi, şampiyon seçimi.
// Olaylar websocket'ten gelir; kaçan olaylara karşı kısa aralıklı yoklama da yapılır.

const crypto = require('crypto');
const { EventEmitter } = require('events');
const { buildView, flattenActions, isPickOrBan } = require('./view');
const { searchKeys } = require('../text');

const PHASE_LABELS = {
  None: 'Ana menü',
  Lobby: 'Lobide',
  Matchmaking: 'Sırada',
  CheckedIntoTournament: 'Turnuvaya kayıtlı',
  ReadyCheck: 'Maç bulundu',
  ChampSelect: 'Şampiyon seçimi',
  GameStart: 'Oyun başlıyor',
  FailedToLaunch: 'Oyun başlatılamadı',
  InProgress: 'Oyunda',
  Reconnect: 'Yeniden bağlanma bekleniyor',
  WaitingForStats: 'Sonuçlar bekleniyor',
  PreEndOfGame: 'Oyun sonu',
  EndOfGame: 'Oyun bitti',
  TerminatedInError: 'Oyun hatayla kapandı',
};

const randomId = () => crypto.randomBytes(4).toString('hex');

/** LCU görsel yolunu kendi vekil adresimize çevirir. */
function assetUrl(p) {
  if (typeof p !== 'string' || !p.startsWith('/lol-game-data/assets/')) return '';
  return `/lcu-asset${p}`;
}

function emptyRaw() {
  return {
    phase: 'None',
    gameflow: null,
    readyCheck: null,
    search: null,
    searchAt: 0,
    lobby: null,
    session: null,
    sessionAt: 0,
    pickable: [],
    bannable: [],
    summoner: null,
    perkPages: [],
    perkCurrentId: null,
  };
}

class GameState extends EventEmitter {
  constructor({ lcu, log, pollMs = 2000 }) {
    super();
    this.setMaxListeners(50);
    this.lcu = lcu;
    this.log = log;
    this.pollMs = pollMs;
    this.raw = emptyRaw();
    this.statics = { version: 0, loaded: false, champions: [], byId: new Map(), spells: [], perkStyles: [] };
    this.rcMeta = { active: false, id: null, startedAt: 0, lastResponse: 'None', autoAcceptAt: null };
    this.cs = { id: null, active: null };
    this.listsSig = '';
    this.fetchedAt = {};
    this.changeTimer = null;
    this.listsTimer = null;
    this.polling = false;

    lcu.on('connected', () => this.onConnected());
    lcu.on('disconnected', () => this.onDisconnected());
    lcu.on('event', (e) => this.onEvent(e));
    lcu.on('status', () => this.changed());
  }

  start() {
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.poll(), this.pollMs);
  }

  stop() {
    clearInterval(this.pollTimer);
    clearTimeout(this.changeTimer);
    clearTimeout(this.listsTimer);
  }

  /** Değişiklikleri kısa bir süre biriktirip tek 'change' olayı yayar. */
  changed() {
    if (this.changeTimer) return;
    this.changeTimer = setTimeout(() => {
      this.changeTimer = null;
      this.emit('change');
    }, 40);
  }

  view() {
    return buildView({
      raw: this.raw,
      statics: this.statics,
      rcMeta: this.rcMeta,
      lcuStatus: this.lcu.status,
      now: Date.now(),
    });
  }

  champion(id) {
    return this.statics.byId.get(Number(id)) || null;
  }

  championName(id) {
    const c = this.champion(id);
    return c ? c.name : `#${id}`;
  }

  /** GET isteği; 404 "kaynak yok" demektir (ör. lobi yok) ve null uygulanır. */
  async fetch(urlPath, apply) {
    this.fetchedAt[urlPath] = Date.now();
    try {
      const data = await this.lcu.get(urlPath);
      apply(data);
      this.changed();
      return data;
    } catch (e) {
      if (e.status === 404) {
        apply(null);
        this.changed();
      } else {
        this.log.debug(`GET ${urlPath} başarısız:`, e.message);
      }
      return null;
    }
  }

  async onConnected() {
    this.raw = emptyRaw();
    this.changed();
    await Promise.all([
      this.statics.loaded ? null : this.loadStatics(),
      this.fetch('/lol-summoner/v1/current-summoner', (d) => {
        this.raw.summoner = d;
      }),
      this.fetchPhase(),
      this.fetchPerks(),
    ]);
  }

  onDisconnected() {
    this.setReadyCheck(null);
    this.setSession(null);
    this.raw = emptyRaw();
    this.changed();
  }

  async fetchPhase() {
    try {
      const phase = await this.lcu.get('/lol-gameflow/v1/gameflow-phase');
      this.setPhase(phase, true);
    } catch (e) {
      this.log.debug('Oyun durumu alınamadı:', e.message);
    }
  }

  fetchPerks() {
    return Promise.all([
      this.fetch('/lol-perks/v1/pages', (d) => {
        this.raw.perkPages = Array.isArray(d) ? d : [];
      }),
      this.fetch('/lol-perks/v1/currentpage', (d) => {
        this.raw.perkCurrentId = d && d.id != null ? d.id : null;
      }),
    ]);
  }

  setPhase(value, force = false) {
    const phase = typeof value === 'string' && value ? value : 'None';
    const prev = this.raw.phase;
    if (phase === prev && !force) return;
    this.raw.phase = phase;
    if (phase !== prev) {
      this.log.info(`Durum: ${PHASE_LABELS[phase] || phase}`);
      this.emit('phase', phase, prev);
    }
    this.refreshForPhase(phase);
    this.changed();
  }

  refreshForPhase(phase) {
    this.fetch('/lol-gameflow/v1/session', (d) => {
      this.raw.gameflow = d;
    });
    this.fetch('/lol-matchmaking/v1/ready-check', (d) => this.setReadyCheck(d));
    if (['None', 'Lobby', 'Matchmaking', 'ReadyCheck', 'EndOfGame'].includes(phase)) {
      this.fetch('/lol-lobby/v2/lobby', (d) => {
        this.raw.lobby = d;
      });
      this.fetch('/lol-matchmaking/v1/search', (d) => this.setSearch(d));
    } else {
      this.setSearch(null);
    }
    if (phase === 'ChampSelect') {
      this.fetch('/lol-champ-select/v1/session', (d) => this.setSession(d));
      this.fetchPerks();
    } else if (this.raw.session) {
      this.setSession(null);
    }
  }

  setSearch(d) {
    this.raw.search = d && typeof d === 'object' ? d : null;
    this.raw.searchAt = Date.now();
    this.changed();
  }

  setReadyCheck(d) {
    const rc = d && typeof d === 'object' && d.state ? d : null;
    this.raw.readyCheck = rc;
    this.fetchedAt.readyCheck = Date.now();
    const active = Boolean(rc && rc.state === 'InProgress');
    if (rc && rc.playerResponse) this.rcMeta.lastResponse = rc.playerResponse;
    if (active && !this.rcMeta.active) {
      this.rcMeta = {
        active: true,
        id: randomId(),
        startedAt: Date.now() - Math.max(0, Number(rc.timer) || 0) * 1000,
        lastResponse: rc.playerResponse || 'None',
        autoAcceptAt: null,
      };
      this.log.info('Maç bulundu! Telefondan kabul edebilirsin.');
      this.emit('readyCheckStarted', { id: this.rcMeta.id });
    } else if (!active && this.rcMeta.active) {
      this.rcMeta.active = false;
      this.rcMeta.autoAcceptAt = null;
      this.emit('readyCheckEnded', {
        id: this.rcMeta.id,
        response: this.rcMeta.lastResponse,
        state: rc ? rc.state : 'Invalid',
      });
    }
    this.changed();
  }

  setSession(d) {
    const session = d && typeof d === 'object' && Array.isArray(d.myTeam) ? d : null;
    this.raw.session = session;
    this.raw.sessionAt = Date.now();
    if (!session) {
      this.raw.pickable = [];
      this.raw.bannable = [];
      this.listsSig = '';
    } else {
      // Seçilebilir/banlanabilir listeleri yalnızca tamamlanan eylemler değişince yenile
      const sig = flattenActions(session.actions)
        .filter((a) => isPickOrBan(a) && a.completed)
        .map((a) => `${a.id}:${a.championId}`)
        .join(',');
      if (sig !== this.listsSig || !this.raw.pickable.length) {
        this.listsSig = sig;
        this.scheduleChampLists();
      }
    }
    this.trackChampSelect();
    this.changed();
  }

  scheduleChampLists() {
    clearTimeout(this.listsTimer);
    this.listsTimer = setTimeout(() => this.refreshChampLists(), 100);
  }

  async refreshChampLists() {
    if (!this.raw.session) return;
    const [pickable, bannable] = await Promise.all([
      this.lcu.get('/lol-champ-select/v1/pickable-champion-ids').catch(() => null),
      this.lcu.get('/lol-champ-select/v1/bannable-champion-ids').catch(() => null),
    ]);
    if (!this.raw.session) return;
    if (Array.isArray(pickable)) this.raw.pickable = pickable;
    if (Array.isArray(bannable)) this.raw.bannable = bannable;
    this.changed();
  }

  /** Seçim ekranına girme/çıkma ve "sıra bende" geçişlerini olay olarak yayar. */
  trackChampSelect() {
    const s = this.raw.session;
    if (s && !this.cs.id) {
      this.cs = { id: randomId(), active: null };
      this.emit('champSelectStarted', { csId: this.cs.id });
    }
    if (!s) {
      if (this.cs.id) {
        const { id, active } = this.cs;
        this.cs = { id: null, active: null };
        if (active) this.emit('myTurnEnded', { ...active, csId: id, completed: false, championId: 0 });
        this.emit('champSelectEnded', { csId: id });
      }
      return;
    }
    const me = s.localPlayerCellId;
    const acts = flattenActions(s.actions).filter((a) => isPickOrBan(a) && a.actorCellId === me);
    const current = acts.find((a) => a.isInProgress && !a.completed) || null;
    const prev = this.cs.active;
    if (prev && (!current || current.id !== prev.actionId)) {
      const done = acts.find((a) => a.id === prev.actionId);
      this.cs.active = null;
      this.emit('myTurnEnded', {
        actionId: prev.actionId,
        type: prev.type,
        csId: this.cs.id,
        completed: Boolean(done && done.completed),
        championId: done ? Number(done.championId) || 0 : 0,
      });
    }
    if (current && (!prev || prev.actionId !== current.id)) {
      this.cs.active = { actionId: current.id, type: current.type };
      this.emit('myTurnStarted', { actionId: current.id, type: current.type, csId: this.cs.id });
    }
  }

  onEvent({ uri, eventType, data }) {
    const del = eventType === 'Delete';
    switch (uri) {
      case '/lol-gameflow/v1/gameflow-phase':
        this.setPhase(del ? 'None' : data);
        break;
      case '/lol-gameflow/v1/session':
        this.raw.gameflow = del ? null : data;
        if (!del && data && typeof data.phase === 'string' && data.phase !== this.raw.phase) this.setPhase(data.phase);
        this.changed();
        break;
      case '/lol-matchmaking/v1/ready-check':
        this.setReadyCheck(del ? null : data);
        break;
      case '/lol-matchmaking/v1/search':
        this.setSearch(del ? null : data);
        break;
      case '/lol-lobby/v2/lobby':
        this.raw.lobby = del ? null : data;
        this.changed();
        break;
      case '/lol-champ-select/v1/session':
        this.setSession(del ? null : data);
        break;
      case '/lol-champ-select/v1/pickable-champion-ids':
        if (Array.isArray(data)) {
          this.raw.pickable = data;
          this.changed();
        }
        break;
      case '/lol-champ-select/v1/bannable-champion-ids':
        if (Array.isArray(data)) {
          this.raw.bannable = data;
          this.changed();
        }
        break;
      case '/lol-perks/v1/pages':
        this.raw.perkPages = Array.isArray(data) ? data : [];
        this.changed();
        break;
      case '/lol-perks/v1/currentpage':
        this.raw.perkCurrentId = !del && data && data.id != null ? data.id : null;
        this.changed();
        break;
      case '/lol-summoner/v1/current-summoner':
        if (!del && data && typeof data === 'object') {
          this.raw.summoner = data;
          this.changed();
        }
        break;
      default:
        break;
    }
  }

  /** Olay kaçırılırsa diye düzenli yoklama. */
  async poll() {
    if (!this.lcu.connected || this.polling) return;
    this.polling = true;
    try {
      const phase = await this.lcu.get('/lol-gameflow/v1/gameflow-phase').catch(() => null);
      if (typeof phase === 'string' && phase && phase !== this.raw.phase) this.setPhase(phase);
      const now = Date.now();
      const stale = (key, ms) => now - (this.fetchedAt[key] || 0) > ms;
      const p = this.raw.phase;
      if (p === 'ChampSelect' && now - this.raw.sessionAt > 3000) {
        await this.fetch('/lol-champ-select/v1/session', (d) => this.setSession(d));
      }
      if ((p === 'ReadyCheck' || this.rcMeta.active) && now - (this.fetchedAt.readyCheck || 0) > 1500) {
        await this.fetch('/lol-matchmaking/v1/ready-check', (d) => this.setReadyCheck(d));
      }
      if (p === 'Matchmaking' && now - this.raw.searchAt > 5000) {
        await this.fetch('/lol-matchmaking/v1/search', (d) => this.setSearch(d));
      }
      if ((p === 'Lobby' || p === 'Matchmaking') && !this.raw.lobby && stale('/lol-lobby/v2/lobby', 4000)) {
        await this.fetch('/lol-lobby/v2/lobby', (d) => {
          this.raw.lobby = d;
        });
      }
      if (!this.statics.loaded && now - (this.fetchedAt.statics || 0) > 5000) await this.loadStatics();
      if (!this.raw.summoner && stale('/lol-summoner/v1/current-summoner', 5000)) {
        await this.fetch('/lol-summoner/v1/current-summoner', (d) => {
          this.raw.summoner = d;
        });
      }
    } finally {
      this.polling = false;
    }
  }

  /** Şampiyon, büyü ve rün stili listeleri (istemcinin dilinde). */
  async loadStatics() {
    this.fetchedAt.statics = Date.now();
    try {
      const [champs, spells, styles] = await Promise.all([
        this.lcu.get('/lol-game-data/assets/v1/champion-summary.json'),
        this.lcu.get('/lol-game-data/assets/v1/summoner-spells.json').catch(() => []),
        this.lcu.get('/lol-game-data/assets/v1/perkstyles.json').catch(() => null),
      ]);
      if (!Array.isArray(champs) || champs.length < 2) throw new Error('şampiyon listesi boş');
      const champions = champs
        .filter((c) => c && Number(c.id) > 0 && c.name)
        .map((c) => ({
          id: Number(c.id),
          name: String(c.name),
          alias: String(c.alias || ''),
          roles: Array.isArray(c.roles) ? c.roles : [],
          icon: assetUrl(c.squarePortraitPath) || `/lcu-asset/lol-game-data/assets/v1/champion-icons/${c.id}.png`,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      for (const c of champions) c.keys = searchKeys(c);
      const spellList = (Array.isArray(spells) ? spells : [])
        .filter((s) => s && Number(s.id) > 0 && Array.isArray(s.gameModes) && s.gameModes.length && !/placeholder/i.test(s.name || ''))
        .map((s) => ({ id: Number(s.id), name: String(s.name || ''), icon: assetUrl(s.iconPath), modes: s.gameModes }));
      const styleList = (styles && Array.isArray(styles.styles) ? styles.styles : [])
        .filter((s) => s && s.id)
        .map((s) => ({ id: Number(s.id), name: String(s.name || ''), icon: assetUrl(s.iconPath) }));
      this.statics = {
        version: this.statics.version + 1,
        loaded: true,
        champions,
        byId: new Map(champions.map((c) => [c.id, c])),
        spells: spellList,
        perkStyles: styleList,
      };
      this.log.ok(`${champions.length} şampiyon listesi yüklendi`);
      this.changed();
    } catch (e) {
      this.log.debug('Oyun verisi henüz alınamadı:', e.message);
    }
  }

  staticsPayload() {
    const s = this.statics;
    return {
      version: s.version,
      champions: s.champions.map(({ id, name, alias, roles, icon, keys }) => ({ id, name, alias, roles, icon, keys })),
      spells: s.spells,
      perkStyles: s.perkStyles,
    };
  }
}

module.exports = { GameState, PHASE_LABELS, assetUrl, emptyRaw };
