'use strict';
// Sahte League istemcisi (LCU): gerçek istemcinin yerel REST + WAMP websocket arayüzünü taklit eder.
// Demo modu (`npm run demo`) ve otomatik testler bunu kullanır.
//
// Akış: Lobi → (Sıraya gir) → Sırada → Maç bulundu (kabul/ret) → Şampiyon seçimi
//       (planlama → 10 ban → ban açıklama → seçim turları → son hazırlık) → Oyun → Oyun bitti
// Diğer 9 oyuncu bot gibi davranır: şampiyon işaretler ve kilitler.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const data = require('./data');

const POSITIONS = ['top', 'jungle', 'middle', 'bottom', 'utility'];
const QUEUES = {
  420: { description: 'Dereceli Tek/Çift', gameMode: 'CLASSIC', type: 'RANKED_SOLO_5x5', ranked: true },
  440: { description: 'Dereceli Esnek', gameMode: 'CLASSIC', type: 'RANKED_FLEX_SR', ranked: true },
  400: { description: 'Seçmeli', gameMode: 'CLASSIC', type: 'NORMAL', ranked: false },
  450: { description: 'ARAM', gameMode: 'ARAM', type: 'ARAM_UNRANKED_5x5', ranked: false },
  1700: { description: 'Arena', gameMode: 'CHERRY', type: 'CHERRY', ranked: false },
};
const ALLY_NAMES = ['Kırmızı Ejder', 'OrmanınKralı', 'Demo', 'Kuzey Okçusu', 'Şifacı Bilge'];
const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clone = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k.startsWith('_') ? undefined : v)));

class LcuHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

class MockLcu {
  constructor({
    port = 0,
    speed = 1,
    lockfileDir = '',
    tls = null,
    log = null,
    declineChance = 0,
    fetchIcons = true,
    timings = {},
  } = {}) {
    this.port = port;
    this.speed = speed > 0 ? speed : 1;
    this.tls = tls;
    this.log = log;
    this.declineChance = declineChance;
    this.fetchIcons = fetchIcons;
    this.password = crypto.randomBytes(16).toString('base64url');
    this.lockfileDir = lockfileDir || fs.mkdtempSync(path.join(os.tmpdir(), 'lol-kumanda-demo-'));
    this.lockfile = path.join(this.lockfileDir, 'lockfile');
    this.calls = [];
    this.timers = new Set();
    this.sockets = new Set();
    this.iconCache = new Map();
    this.iconsOfflineUntil = 0;
    this.T = {
      queue: 5000,
      readyCheck: 12000,
      settle: 1200,
      planning: 8000,
      ban: 27000,
      reveal: 2500,
      pick: 27000,
      finalization: 25000,
      aram: 45000,
      gameStarting: 3000,
      game: 20000,
      ...timings,
    };

    this.phase = 'Lobby';
    this.summoner = {
      accountId: 2001001,
      displayName: '',
      gameName: 'Demo',
      tagLine: 'TR1',
      internalName: 'Demo',
      profileIconId: 29,
      puuid: crypto.randomUUID(),
      summonerId: 1001001,
      summonerLevel: 187,
      percentCompleteForNextLevel: 42,
    };
    this.lobby = this.makeLobby(420);
    this.search = null;
    this.readyCheck = null;
    this.session = null;
    this.perkPages = data.PERK_PAGES.map((p, i) => ({ ...p, current: i === 0, isActive: i === 0, isDeletable: true, order: i }));
    this.perkCurrentId = this.perkPages[0].id;
  }

  ms(v) {
    return Math.max(1, Math.round(v / this.speed));
  }

  schedule(fn, delay) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      try {
        fn();
      } catch (e) {
        if (this.log) this.log.error('Sahte istemci hatası:', e.stack || e.message);
      }
    }, this.ms(delay));
    this.timers.add(t);
    return t;
  }

  cancel(t) {
    if (t) {
      clearTimeout(t);
      clearInterval(t);
      this.timers.delete(t);
    }
  }

  every(fn, delay) {
    const t = setInterval(fn, this.ms(delay));
    this.timers.add(t);
    return t;
  }

  /* ---------- sunucu ---------- */

  async start() {
    const handler = (req, res) => this.handle(req, res);
    this.server = this.tls ? https.createServer(this.tls, handler) : http.createServer(handler);
    this.wss = new WebSocketServer({
      server: this.server,
      verifyClient: (info) => this.authOk(info.req.headers.authorization),
    });
    this.wss.on('connection', (ws) => {
      ws.subs = new Set();
      this.sockets.add(ws);
      ws.on('message', (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch (_) {
          return;
        }
        if (Array.isArray(msg) && msg[0] === 5 && typeof msg[1] === 'string') ws.subs.add(msg[1]);
        if (Array.isArray(msg) && msg[0] === 6 && typeof msg[1] === 'string') ws.subs.delete(msg[1]);
      });
      ws.on('close', () => this.sockets.delete(ws));
    });
    await new Promise((resolve) => this.server.listen(this.port, '127.0.0.1', resolve));
    this.port = this.server.address().port;
    const protocol = this.tls ? 'https' : 'http';
    fs.writeFileSync(this.lockfile, `LeagueClient:${process.pid}:${this.port}:${this.password}:${protocol}`);
    return this;
  }

  async close() {
    for (const t of this.timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    this.timers.clear();
    for (const ws of this.sockets) ws.terminate();
    try {
      fs.unlinkSync(this.lockfile);
    } catch (_) {
      /* yoksay */
    }
    await new Promise((resolve) => {
      this.wss.close(() => this.server.close(() => resolve()));
      if (this.server.closeAllConnections) this.server.closeAllConnections();
    });
  }

  /** İstemcinin kapanmasını taklit eder (websocket kopar, lockfile silinir). */
  async simulateClientExit() {
    await this.close();
  }

  authOk(header) {
    return header === `Basic ${Buffer.from(`riot:${this.password}`).toString('base64')}`;
  }

  emit(uri, payload, eventType = 'Update') {
    const specific = `OnJsonApiEvent${uri.replace(/\//g, '_')}`;
    const body = { data: payload === undefined ? null : clone(payload), eventType, uri };
    for (const ws of this.sockets) {
      if (ws.readyState !== 1) continue;
      if (ws.subs.has('OnJsonApiEvent')) ws.send(JSON.stringify([8, 'OnJsonApiEvent', body]));
      else if (ws.subs.has(specific)) ws.send(JSON.stringify([8, specific, body]));
    }
  }

  setPhase(phase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.emit('/lol-gameflow/v1/gameflow-phase', phase);
    this.emit('/lol-gameflow/v1/session', this.gameflowSession());
  }

  /* ---------- veri ---------- */

  makeLobby(queueId) {
    const q = QUEUES[queueId] || QUEUES[420];
    const member = {
      isLeader: true,
      puuid: this.summoner ? this.summoner.puuid : '',
      summonerId: 1001001,
      gameName: 'Demo',
      tagLine: 'TR1',
      firstPositionPreference: 'MIDDLE',
      secondPositionPreference: 'TOP',
      ready: true,
    };
    return {
      canStartActivity: true,
      gameConfig: {
        queueId,
        gameMode: q.gameMode,
        isCustom: false,
        maxLobbySize: 5,
        mapId: q.gameMode === 'ARAM' ? 12 : 11,
        showPositionSelector: q.gameMode === 'CLASSIC',
      },
      localMember: member,
      members: [member],
      invitations: [],
      partyId: crypto.randomUUID(),
      partyType: 'open',
      restrictions: [],
      warnings: [],
    };
  }

  queueId() {
    return this.lobby ? this.lobby.gameConfig.queueId : 420;
  }

  gameflowSession() {
    const queueId = this.queueId();
    const q = QUEUES[queueId] || QUEUES[420];
    return {
      phase: this.phase,
      gameData: {
        gameId: 0,
        isCustomGame: false,
        queue: { id: queueId, gameMode: q.gameMode, description: q.description, shortName: q.description, type: q.type },
      },
      map: { id: q.gameMode === 'ARAM' ? 12 : 11 },
    };
  }

  owned(id) {
    return !data.NOT_OWNED.has(id);
  }

  champName(id) {
    const c = data.CHAMPIONS.find((x) => x.id === id);
    return c ? c.name : String(id);
  }

  cell(cellId) {
    const s = this.session;
    return s ? [...s.myTeam, ...s.theirTeam].find((p) => p.cellId === cellId) || null : null;
  }

  allActions() {
    return this.session ? this.session.actions.flat() : [];
  }

  takenIds() {
    const picked = new Set();
    const banned = new Set();
    for (const a of this.allActions()) {
      if (!a.completed) continue;
      const id = a._championId || a.championId;
      if (!id) continue;
      if (a.type === 'pick') picked.add(id);
      if (a.type === 'ban') banned.add(id);
    }
    if (this.session) for (const p of [...this.session.myTeam, ...this.session.theirTeam]) if (p.championId && this.session.benchEnabled) picked.add(p.championId);
    return { picked, banned };
  }

  pickableIds() {
    if (!this.session) return [];
    const { picked, banned } = this.takenIds();
    return data.CHAMPIONS.map((c) => c.id).filter((id) => this.owned(id) && !picked.has(id) && !banned.has(id));
  }

  bannableIds() {
    if (!this.session) return [];
    const { picked, banned } = this.takenIds();
    return data.CHAMPIONS.map((c) => c.id).filter((id) => !picked.has(id) && !banned.has(id));
  }

  sessionPayload() {
    const s = this.session;
    if (!s) return null;
    const now = Date.now();
    s.timer.adjustedTimeLeftInPhase = s._phaseEndsAt ? Math.max(0, s._phaseEndsAt - now) : 0;
    s.timer.internalNowInEpochMs = now;
    return clone(s);
  }

  emitSession(eventType = 'Update') {
    if (!this.session) return;
    this.session.counter += 1;
    this.emit('/lol-champ-select/v1/session', this.sessionPayload(), eventType);
  }

  emitLists() {
    this.emit('/lol-champ-select/v1/pickable-champion-ids', this.pickableIds());
    this.emit('/lol-champ-select/v1/bannable-champion-ids', this.bannableIds());
  }

  /* ---------- sıra ve maç kabul ---------- */

  startSearch() {
    if (!this.lobby) throw new LcuHttpError(400, 'Not in a lobby');
    if (this.phase === 'Matchmaking' || this.phase === 'ReadyCheck') return;
    this.searchStartedAt = Date.now();
    this.search = {
      dodgeData: { dodgerId: 0, state: 'Invalid' },
      errors: [],
      estimatedQueueTime: 95.0,
      isCurrentlyInQueue: true,
      lobbyId: this.lobby.partyId,
      lowPriorityData: { bustedLeaverAccessToken: '', penalizedSummonerIds: [], penaltyTime: 0, penaltyTimeRemaining: 0, reason: '' },
      queueId: this.queueId(),
      readyCheck: { state: 'Invalid', playerResponse: 'None', timer: 0, declinerIds: [] },
      searchState: 'Searching',
      timeInQueue: 0,
    };
    this.setPhase('Matchmaking');
    this.emit('/lol-matchmaking/v1/search', this.search);
    this.cancel(this.searchTick);
    this.searchTick = this.every(() => {
      if (!this.search) return;
      this.search.timeInQueue = Math.round((Date.now() - this.searchStartedAt) / 1000);
      this.emit('/lol-matchmaking/v1/search', this.search);
    }, 1000);
    this.cancel(this.foundTimer);
    this.foundTimer = this.schedule(() => this.startReadyCheck(), this.T.queue);
  }

  stopSearch(toPhase = 'Lobby') {
    this.cancel(this.searchTick);
    this.cancel(this.foundTimer);
    this.cancel(this.rcTick);
    this.cancel(this.rcTimeout);
    if (this.search) {
      this.search = null;
      this.emit('/lol-matchmaking/v1/search', { searchState: 'Invalid', errors: [], timeInQueue: 0, estimatedQueueTime: 0 });
    }
    if (this.readyCheck) {
      this.readyCheck = null;
      this.emit('/lol-matchmaking/v1/ready-check', null, 'Delete');
    }
    this.setPhase(toPhase);
  }

  startReadyCheck() {
    if (!this.search) return;
    this.cancel(this.searchTick);
    this.search.searchState = 'Found';
    this.emit('/lol-matchmaking/v1/search', this.search);
    this.readyCheck = { declinerIds: [], dodgeWarning: 'None', playerResponse: 'None', state: 'InProgress', suppressUx: false, timer: 0 };
    this.rcStartedAt = Date.now();
    this.setPhase('ReadyCheck');
    this.emit('/lol-matchmaking/v1/ready-check', this.readyCheck, 'Create');
    this.rcTick = this.every(() => {
      if (!this.readyCheck) return;
      this.readyCheck.timer = Math.floor((Date.now() - this.rcStartedAt) / 1000 * this.speed);
      this.emit('/lol-matchmaking/v1/ready-check', this.readyCheck);
    }, 1000);
    this.rcTimeout = this.schedule(() => {
      // Süre doldu: kabul etmeyen oyuncu sıradan atılır
      if (this.readyCheck && this.readyCheck.playerResponse === 'None') this.stopSearch('Lobby');
    }, this.T.readyCheck);
  }

  answerReadyCheck(accept) {
    const rc = this.readyCheck;
    if (!rc || rc.state !== 'InProgress') throw new LcuHttpError(400, 'No ready check in progress');
    rc.playerResponse = accept ? 'Accepted' : 'Declined';
    this.emit('/lol-matchmaking/v1/ready-check', rc);
    this.cancel(this.rcTimeout);
    if (!accept) {
      this.schedule(() => this.stopSearch('Lobby'), 600);
      return;
    }
    this.schedule(() => {
      if (!this.readyCheck) return;
      this.cancel(this.rcTick);
      if (Math.random() < this.declineChance) {
        // Başka bir oyuncu kabul etmedi: sıraya geri dön
        this.readyCheck.state = 'StrangerNotReady';
        this.readyCheck.declinerIds = [9999];
        this.emit('/lol-matchmaking/v1/ready-check', this.readyCheck);
        this.schedule(() => {
          this.readyCheck = null;
          this.emit('/lol-matchmaking/v1/ready-check', null, 'Delete');
          this.search = null;
          this.setPhase('Lobby');
          this.startSearch();
        }, 1200);
        return;
      }
      this.readyCheck.state = 'EveryoneReady';
      this.emit('/lol-matchmaking/v1/ready-check', this.readyCheck);
      this.schedule(() => {
        this.readyCheck = null;
        this.emit('/lol-matchmaking/v1/ready-check', null, 'Delete');
        this.search = null;
        this.emit('/lol-matchmaking/v1/search', { searchState: 'Invalid', errors: [], timeInQueue: 0, estimatedQueueTime: 0 });
        this.startChampSelect();
      }, 700);
    }, this.T.settle);
  }

  /* ---------- şampiyon seçimi ---------- */

  myPosition() {
    const pref = String((this.lobby && this.lobby.localMember.firstPositionPreference) || '').toLowerCase();
    return POSITIONS.includes(pref) ? pref : 'middle';
  }

  startChampSelect() {
    const queueId = this.queueId();
    const q = QUEUES[queueId] || QUEUES[420];
    const aram = q.gameMode === 'ARAM';
    const myPos = this.myPosition();
    const me = POSITIONS.indexOf(myPos);
    const spells = [
      [11, 4],
      [11, 4],
      [14, 4],
      [7, 4],
      [3, 4],
    ];
    const mkPlayer = (cellId, team) => {
      const ally = team === 1;
      const pos = POSITIONS[cellId % 5];
      const isMe = ally && cellId === me;
      const [s1, s2] = spells[cellId % 5];
      return {
        assignedPosition: ally && !aram ? pos : '',
        cellId,
        championId: 0,
        championPickIntent: 0,
        entitledFeatureType: 'NONE',
        nameVisibilityType: isMe || !q.ranked ? 'VISIBLE' : 'HIDDEN',
        gameName: ally ? (isMe ? 'Demo' : ALLY_NAMES[cellId]) : '',
        tagLine: ally ? 'TR1' : '',
        obfuscatedPuuid: '',
        obfuscatedSummonerId: 0,
        puuid: isMe ? this.summoner.puuid : crypto.randomUUID(),
        selectedSkinId: 0,
        spell1Id: aram ? 32 : s1,
        spell2Id: s2,
        summonerId: isMe ? this.summoner.summonerId : 3000 + cellId,
        team,
        wardSkinId: -1,
        _pos: pos,
      };
    };
    const myTeam = [0, 1, 2, 3, 4].map((c) => mkPlayer(c, 1));
    const theirTeam = [5, 6, 7, 8, 9].map((c) => mkPlayer(c, 2));
    let id = 1;
    const act = (actorCellId, type) => ({
      actorCellId,
      championId: 0,
      completed: false,
      id: id++,
      isAllyAction: actorCellId < 5,
      isInProgress: false,
      pickTurn: 0,
      type,
    });
    let actions = [];
    if (!aram) {
      actions = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => act(c, 'ban')),
        [act(-1, 'ten_bans_reveal')],
        [act(0, 'pick')],
        [act(5, 'pick'), act(6, 'pick')],
        [act(1, 'pick'), act(2, 'pick')],
        [act(7, 'pick'), act(8, 'pick')],
        [act(3, 'pick'), act(4, 'pick')],
        [act(9, 'pick')],
      ];
      actions.forEach((turn, i) => turn.forEach((a) => (a.pickTurn = i + 1)));
    }
    this.session = {
      actions,
      allowBattleBoost: false,
      allowDuplicatePicks: false,
      allowLockedEvents: false,
      allowRerolling: aram,
      allowSkinSelection: true,
      bans: { myTeamBans: [], numBans: aram ? 0 : 10, theirTeamBans: [] },
      benchChampions: [],
      benchEnabled: aram,
      boostableSkinCount: 0,
      chatDetails: { mucJwtDto: {}, multiUserChatId: 'demo', multiUserChatPassword: '' },
      counter: 0,
      gameId: 0,
      hasSimultaneousBans: true,
      hasSimultaneousPicks: false,
      isCustomGame: false,
      isSpectating: false,
      localPlayerCellId: me,
      lockedEventIndex: -1,
      myTeam,
      pickOrderSwaps: [],
      recoveryCounter: 0,
      rerollsRemaining: aram ? 2 : 0,
      skipChampionSelect: false,
      theirTeam,
      timer: { adjustedTimeLeftInPhase: 0, internalNowInEpochMs: Date.now(), isInfinite: false, phase: 'PLANNING', totalTimeInPhase: 0 },
      trades: [],
      _phaseEndsAt: 0,
    };
    this.turnIndex = -1;
    this.setPhase('ChampSelect');
    if (aram) {
      this.startAram();
      return;
    }
    this.emitSession('Create');
    this.emitLists();
    this.enterPhase('PLANNING', this.T.planning, () => this.startTurn(0));
    // Takım arkadaşları planlama aşamasında niyet bildirir
    for (const p of myTeam) {
      if (p.cellId === me) continue;
      this.schedule(() => {
        if (!this.session || this.session.timer.phase !== 'PLANNING') return;
        p.championPickIntent = this.botChoice({ actorCellId: p.cellId, type: 'pick' });
        this.emitSession();
      }, rand(800, 4000));
    }
  }

  enterPhase(phase, duration, next) {
    const s = this.session;
    s.timer.phase = phase;
    s.timer.totalTimeInPhase = this.ms(duration);
    s._phaseEndsAt = Date.now() + this.ms(duration);
    this.emitSession();
    this.cancel(this.phaseTimer);
    this.phaseTimer = next ? this.schedule(next, duration) : null;
  }

  startTurn(index) {
    const s = this.session;
    if (!s) return;
    if (index >= s.actions.length) {
      this.finalization();
      return;
    }
    this.turnIndex = index;
    const turn = s.actions[index];
    if (turn[0].type === 'ten_bans_reveal') {
      turn.forEach((a) => (a.isInProgress = true));
      // Rakip banlar şimdi görünür olur
      for (const a of s.actions.flat()) {
        if (a.type === 'ban' && a._championId) {
          a.championId = a._championId;
          delete a._championId;
        }
      }
      s.bans.myTeamBans = s.actions.flat().filter((a) => a.type === 'ban' && a.isAllyAction && a.championId).map((a) => a.championId);
      s.bans.theirTeamBans = s.actions.flat().filter((a) => a.type === 'ban' && !a.isAllyAction && a.championId).map((a) => a.championId);
      this.scrubBanned();
      this.emitLists();
      this.enterPhase('BAN_PICK', this.T.reveal, () => {
        turn.forEach((a) => {
          a.isInProgress = false;
          a.completed = true;
        });
        this.startTurn(index + 1);
      });
      return;
    }
    for (const a of turn) {
      a.isInProgress = true;
      const p = this.cell(a.actorCellId);
      if (a.type === 'pick' && p && p.championPickIntent && this.pickableIds().includes(p.championPickIntent)) {
        a.championId = p.championPickIntent;
        p.championId = p.championPickIntent;
      }
    }
    this.enterPhase('BAN_PICK', turn[0].type === 'ban' ? this.T.ban : this.T.pick, () => this.turnTimeout(index));
    for (const a of turn) if (a.actorCellId !== s.localPlayerCellId) this.botAct(a, index);
  }

  botChoice(a) {
    const { picked, banned } = this.takenIds();
    const hovered = new Set(this.allActions().filter((x) => x.isInProgress && x.championId && x !== a).map((x) => x.championId));
    const free = (id) => !picked.has(id) && !banned.has(id) && !hovered.has(id);
    if (a.type === 'ban') {
      // Takım arkadaşları birbirinin niyetini görür ve onu banlamaz
      const team = this.session ? (a.actorCellId < 5 ? this.session.myTeam : this.session.theirTeam) : [];
      const intents = new Set(team.map((p) => p.championPickIntent).filter(Boolean));
      const popular = [...new Set(Object.values(data.ROLE_POOLS).flat())].filter((id) => free(id) && !intents.has(id));
      return pickOne(popular.length ? popular : data.CHAMPIONS.map((c) => c.id).filter(free));
    }
    const pos = POSITIONS[a.actorCellId % 5];
    const pool = data.ROLE_POOLS[pos].filter(free);
    return pickOne(pool.length ? pool : data.CHAMPIONS.map((c) => c.id).filter(free));
  }

  botAct(a, index) {
    const hoverAt = rand(1200, 3500);
    const lockAt = hoverAt + rand(900, 2600);
    this.schedule(() => {
      if (!this.session || a.completed || this.turnIndex !== index) return;
      a.championId = a.championId && a.type === 'pick' ? a.championId : this.botChoice(a);
      if (a.type === 'pick') this.cell(a.actorCellId).championId = a.championId;
      this.emitSession();
    }, hoverAt);
    this.schedule(() => {
      if (!this.session || a.completed || this.turnIndex !== index) return;
      const ok = a.type === 'ban' ? this.bannableIds().includes(a.championId) : this.pickableIds().includes(a.championId) || !this.owned(a.championId);
      if (!a.championId || !ok) a.championId = this.botChoice(a);
      this.completeAction(a);
    }, lockAt);
  }

  completeAction(a) {
    const s = this.session;
    a.completed = true;
    a.isInProgress = false;
    if (a.type === 'pick') {
      const p = this.cell(a.actorCellId);
      p.championId = a.championId;
      p.championPickIntent = 0;
    }
    // Eş zamanlı banlarda rakibin banı açıklanana kadar gizli kalır
    if (a.type === 'ban' && !a.isAllyAction && s.hasSimultaneousBans) {
      a._championId = a.championId;
      a.championId = 0;
    }
    if (a.type === 'ban' && a.isAllyAction) s.bans.myTeamBans = s.actions.flat().filter((x) => x.type === 'ban' && x.isAllyAction && x.completed && x.championId).map((x) => x.championId);
    if (a.type === 'ban') this.scrubBanned();
    this.emitSession();
    this.emitLists();
    const turn = s.actions[this.turnIndex];
    if (turn && turn.every((x) => x.completed)) {
      this.cancel(this.phaseTimer);
      const next = this.turnIndex + 1;
      this.schedule(() => this.startTurn(next), 400);
    }
  }

  /** Banlanan (ve görünür olan) şampiyonlar, tamamlanmamış seçimlerin işaretinden ve niyetlerden silinir. */
  scrubBanned() {
    const s = this.session;
    const banned = new Set(s.actions.flat().filter((x) => x.type === 'ban' && x.completed && x.championId).map((x) => x.championId));
    for (const x of s.actions.flat()) {
      if (x.type === 'pick' && !x.completed && banned.has(x.championId)) x.championId = 0;
    }
    for (const p of [...s.myTeam, ...s.theirTeam]) {
      if (banned.has(p.championPickIntent)) p.championPickIntent = 0;
      const locked = s.actions.flat().some((x) => x.type === 'pick' && x.completed && x.actorCellId === p.cellId);
      if (!locked && banned.has(p.championId)) p.championId = 0;
    }
  }

  turnTimeout(index) {
    const s = this.session;
    if (!s) return;
    for (const a of s.actions[index]) {
      if (a.completed) continue;
      if (a.type === 'ban') {
        // Süre dolunca işaretli şampiyon banlanır, yoksa ban boş geçer
        if (!a.championId || !this.bannableIds().includes(a.championId)) a.championId = 0;
        this.completeAction(a);
      } else if (a.actorCellId === s.localPlayerCellId) {
        this.dodge();
        return;
      } else {
        a.championId = this.botChoice(a);
        this.completeAction(a);
      }
    }
    if (this.session && this.turnIndex === index) this.startTurn(index + 1);
  }

  dodge() {
    for (const t of this.timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    this.timers.clear();
    this.session = null;
    this.emit('/lol-champ-select/v1/session', null, 'Delete');
    this.setPhase('Lobby');
  }

  finalization() {
    const s = this.session;
    this.turnIndex = s.actions.length;
    const me = s.localPlayerCellId;
    s.trades = s.myTeam.filter((p) => p.cellId !== me).map((p, i) => ({ cellId: p.cellId, id: i + 1, state: 'AVAILABLE' }));
    this.enterPhase('FINALIZATION', this.T.finalization, () => this.gameStarting());
    this.schedule(() => {
      if (!this.session || this.session.timer.phase !== 'FINALIZATION') return;
      const t = this.session.trades.find((x) => x.cellId === (me === 1 ? 0 : 1));
      if (t) {
        t.state = 'RECEIVED';
        this.emitSession();
      }
    }, 3500);
  }

  answerTrade(id, accept) {
    const s = this.session;
    const t = s && s.trades.find((x) => x.id === id);
    if (!t || t.state !== 'RECEIVED') throw new LcuHttpError(400, 'Trade not available');
    if (accept) {
      const mine = this.cell(s.localPlayerCellId);
      const other = this.cell(t.cellId);
      [mine.championId, other.championId] = [other.championId, mine.championId];
      for (const a of s.actions.flat()) {
        if (a.type !== 'pick') continue;
        if (a.actorCellId === mine.cellId) a.championId = mine.championId;
        else if (a.actorCellId === other.cellId) a.championId = other.championId;
      }
    }
    t.state = accept ? 'ACCEPTED' : 'DECLINED';
    this.emitSession();
    this.schedule(() => {
      if (!this.session) return;
      t.state = 'AVAILABLE';
      this.emitSession();
    }, 1000);
  }

  startAram() {
    const s = this.session;
    const pool = data.CHAMPIONS.map((c) => c.id);
    const used = new Set();
    const draw = (ownedOnly) => {
      const options = pool.filter((id) => !used.has(id) && (!ownedOnly || this.owned(id)));
      const id = pickOne(options);
      used.add(id);
      return id;
    };
    for (const p of [...s.myTeam, ...s.theirTeam]) p.championId = draw(p.cellId === s.localPlayerCellId);
    this._aramDraw = draw;
    this.emitSession('Create');
    this.emitLists();
    this.enterPhase('BAN_PICK', this.T.aram, () => this.gameStarting());
    // Botlar arada bir zar atar; şampiyonları yedek kulübesine düşer
    this.aramTick = this.every(() => {
      if (!this.session || s.benchChampions.length >= 10) return;
      const bot = pickOne(s.myTeam.filter((p) => p.cellId !== s.localPlayerCellId));
      s.benchChampions.push({ championId: bot.championId, isPriority: false });
      bot.championId = draw(false);
      this.emitSession();
    }, 5000);
  }

  reroll() {
    const s = this.session;
    if (!s || !s.allowRerolling || s.rerollsRemaining <= 0) throw new LcuHttpError(400, 'Cannot reroll');
    const me = this.cell(s.localPlayerCellId);
    s.benchChampions.push({ championId: me.championId, isPriority: false });
    if (s.benchChampions.length > 10) s.benchChampions.shift();
    me.championId = this._aramDraw(true);
    s.rerollsRemaining -= 1;
    this.emitSession();
  }

  benchSwap(championId) {
    const s = this.session;
    if (!s || !s.benchEnabled) throw new LcuHttpError(400, 'Bench not enabled');
    const idx = s.benchChampions.findIndex((b) => b.championId === championId);
    if (idx < 0) throw new LcuHttpError(400, 'Champion not on bench');
    const me = this.cell(s.localPlayerCellId);
    s.benchChampions[idx] = { championId: me.championId, isPriority: false };
    me.championId = championId;
    this.emitSession();
  }

  gameStarting() {
    if (!this.session) return;
    this.cancel(this.aramTick);
    this.enterPhase('GAME_STARTING', this.T.gameStarting, () => {
      this.session = null;
      this.emit('/lol-champ-select/v1/session', null, 'Delete');
      this.setPhase('GameStart');
      this.schedule(() => {
        this.setPhase('InProgress');
        this.schedule(() => {
          this.setPhase('WaitingForStats');
          this.schedule(() => {
            this.setPhase('PreEndOfGame');
            this.schedule(() => this.setPhase('EndOfGame'), 1500);
          }, 1500);
        }, this.T.game);
      }, 2500);
    });
  }

  /** Telefondan gelen seçim/ban işlemi. */
  patchAction(id, body) {
    const s = this.session;
    if (!s) throw new LcuHttpError(404, 'No active delegate');
    const a = s.actions.flat().find((x) => x.id === id);
    if (!a) throw new LcuHttpError(404, `Action ${id} not found`);
    if (a.actorCellId !== s.localPlayerCellId) throw new LcuHttpError(403, 'Not your action');
    if (a.completed) throw new LcuHttpError(400, 'Action already completed');
    const championId = Number(body.championId);
    if (body.championId !== undefined) {
      if (a.type === 'ban') {
        if (!a.isInProgress) throw new LcuHttpError(400, 'Action is not in progress');
        if (!this.bannableIds().includes(championId)) throw new LcuHttpError(400, 'Champion not bannable');
        a.championId = championId;
      } else if (a.isInProgress) {
        if (!this.pickableIds().includes(championId)) throw new LcuHttpError(400, 'Champion not pickable');
        a.championId = championId;
        this.cell(a.actorCellId).championId = championId;
      } else {
        // Sıra gelmeden: niyet (intent)
        if (!this.owned(championId)) throw new LcuHttpError(400, 'Champion not owned');
        a.championId = championId;
        this.cell(a.actorCellId).championPickIntent = championId;
      }
    }
    if (body.completed === true) {
      this.completeOwn(a);
      return;
    }
    this.emitSession();
  }

  completeOwn(a) {
    if (!a.isInProgress) throw new LcuHttpError(400, 'Action is not in progress');
    if (!a.championId) throw new LcuHttpError(400, 'No champion selected');
    const ok = a.type === 'ban' ? this.bannableIds().includes(a.championId) : this.pickableIds().includes(a.championId);
    if (!ok) throw new LcuHttpError(400, 'Champion not available');
    this.completeAction(a);
  }

  /* ---------- görseller ---------- */

  placeholder(lcuPath) {
    const m = /champion-icons\/(\d+)\.png$/i.exec(lcuPath);
    let label = '?';
    let hue = 210;
    if (m) {
      const name = this.champName(Number(m[1]));
      label = name
        .split(/[\s'.]+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      hue = (Number(m[1]) * 47) % 360;
    } else if (/spells/i.test(lcuPath)) {
      const spell = data.SPELLS.find((s) => s.iconPath.toLowerCase() === lcuPath.toLowerCase());
      label = spell ? spell.name.slice(0, 2) : 'S';
      hue = 45;
    } else if (/perk-images/i.test(lcuPath)) {
      const style = data.PERK_STYLES.styles.find((s) => s.iconPath.toLowerCase() === lcuPath.toLowerCase());
      label = style ? style.name.slice(0, 1) : 'R';
      hue = 280;
    } else if (/profile-icons/i.test(lcuPath)) {
      label = 'D';
      hue = 190;
    }
    return Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,38%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},50%,18%)"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><text x="32" y="41" font-family="Segoe UI,Roboto,Arial,sans-serif" font-size="24" font-weight="700" fill="#f0e6d2" text-anchor="middle">${label.replace(/[<&>]/g, '')}</text></svg>`,
    );
  }

  fetchIcon(lcuPath) {
    const rel = lcuPath.replace(/^\/lol-game-data\/assets\//, '').toLowerCase();
    return new Promise((resolve) => {
      if (!this.fetchIcons || Date.now() < this.iconsOfflineUntil) {
        resolve(null);
        return;
      }
      const req = https.get(`${CDRAGON}${rel}`, { timeout: 4000 }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ type: res.headers['content-type'] || 'image/png', body: Buffer.concat(chunks) }));
        res.on('error', () => resolve(null));
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', () => {
        this.iconsOfflineUntil = Date.now() + 60000;
        resolve(null);
      });
    });
  }

  async serveAsset(lcuPath, res) {
    const key = lcuPath.toLowerCase();
    let item = this.iconCache.get(key);
    if (!item) {
      item = (await this.fetchIcon(lcuPath)) || { type: 'image/svg+xml', body: this.placeholder(lcuPath) };
      this.iconCache.set(key, item);
    }
    res.writeHead(200, { 'Content-Type': item.type, 'Content-Length': item.body.length });
    res.end(item.body);
  }

  /* ---------- REST yönlendirme ---------- */

  async handle(req, res) {
    if (!this.authOk(req.headers.authorization)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errorCode: 'UNAUTHORIZED', httpStatus: 401, message: 'Unauthorized' }));
      return;
    }
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname;
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const text = Buffer.concat(chunks).toString('utf8');
    let body;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch (_) {
      body = undefined;
    }
    this.calls.push({ method: req.method, path: p, body, at: Date.now() });

    const json = (status, obj) => {
      if (obj === undefined || status === 204) {
        res.writeHead(status === 200 ? 204 : status);
        res.end();
        return;
      }
      const out = JSON.stringify(obj);
      res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(out) });
      res.end(out);
    };

    try {
      if (req.method === 'GET' && p.startsWith('/lol-game-data/assets/') && /\.(png|jpg|jpeg|webp)$/i.test(p)) {
        await this.serveAsset(p, res);
        return;
      }
      const result = this.route(req.method, p, body);
      if (result === undefined) json(204);
      else json(200, result);
    } catch (e) {
      const status = e.status || 500;
      json(status, { errorCode: 'RPC_ERROR', httpStatus: status, implementationDetails: {}, message: e.message });
    }
  }

  route(method, p, body) {
    const M = (m, re) => method === m && re.exec(p);
    let m;
    if (M('GET', /^\/lol-summoner\/v1\/current-summoner$/)) return this.summoner;
    if (M('GET', /^\/lol-gameflow\/v1\/gameflow-phase$/)) return this.phase;
    if (M('GET', /^\/lol-gameflow\/v1\/session$/)) return this.gameflowSession();

    if (M('GET', /^\/lol-lobby\/v2\/lobby$/)) {
      if (!this.lobby || !['Lobby', 'Matchmaking', 'ReadyCheck', 'EndOfGame', 'None'].includes(this.phase)) throw new LcuHttpError(404, 'LOBBY_NOT_FOUND');
      return this.lobby;
    }
    if (M('POST', /^\/lol-lobby\/v2\/lobby$/)) {
      const queueId = Number(body && body.queueId);
      if (!QUEUES[queueId]) throw new LcuHttpError(400, 'Invalid queue');
      if (this.session || ['ReadyCheck', 'InProgress', 'GameStart'].includes(this.phase)) throw new LcuHttpError(409, 'Busy');
      this.stopSearch(this.phase === 'Matchmaking' ? 'Lobby' : this.phase);
      this.lobby = this.makeLobby(queueId);
      this.setPhase('Lobby');
      this.emit('/lol-lobby/v2/lobby', this.lobby, 'Create');
      return this.lobby;
    }
    if (M('PUT', /^\/lol-lobby\/v2\/lobby\/members\/localMember\/position-preferences$/)) {
      if (!this.lobby) throw new LcuHttpError(404, 'LOBBY_NOT_FOUND');
      this.lobby.localMember.firstPositionPreference = body.firstPreference;
      this.lobby.localMember.secondPositionPreference = body.secondPreference;
      this.emit('/lol-lobby/v2/lobby', this.lobby);
      return undefined;
    }
    if (M('POST', /^\/lol-lobby\/v2\/lobby\/matchmaking\/search$/)) {
      this.startSearch();
      return undefined;
    }
    if (M('DELETE', /^\/lol-lobby\/v2\/lobby\/matchmaking\/search$/)) {
      if (this.phase === 'Matchmaking' || this.phase === 'ReadyCheck') this.stopSearch('Lobby');
      return undefined;
    }
    if (M('POST', /^\/lol-lobby\/v2\/play-again$/)) {
      if (this.phase !== 'EndOfGame' && this.phase !== 'PreEndOfGame') throw new LcuHttpError(400, 'Not at end of game');
      this.setPhase('Lobby');
      this.emit('/lol-lobby/v2/lobby', this.lobby);
      return undefined;
    }

    if (M('GET', /^\/lol-matchmaking\/v1\/search$/)) {
      if (!this.search) throw new LcuHttpError(404, 'No active search');
      return this.search;
    }
    if (M('GET', /^\/lol-matchmaking\/v1\/ready-check$/)) {
      if (!this.readyCheck) throw new LcuHttpError(404, 'Not attached to a matchmaking queue.');
      return this.readyCheck;
    }
    if (M('POST', /^\/lol-matchmaking\/v1\/ready-check\/accept$/)) {
      this.answerReadyCheck(true);
      return undefined;
    }
    if (M('POST', /^\/lol-matchmaking\/v1\/ready-check\/decline$/)) {
      this.answerReadyCheck(false);
      return undefined;
    }

    if (M('GET', /^\/lol-champ-select\/v1\/session$/)) {
      if (!this.session) throw new LcuHttpError(404, 'No active delegate');
      return this.sessionPayload();
    }
    if ((m = M('PATCH', /^\/lol-champ-select\/v1\/session\/actions\/(\d+)$/))) {
      this.patchAction(Number(m[1]), body || {});
      return undefined;
    }
    if ((m = M('POST', /^\/lol-champ-select\/v1\/session\/actions\/(\d+)\/complete$/))) {
      const s = this.session;
      const a = s && s.actions.flat().find((x) => x.id === Number(m[1]));
      if (!a) throw new LcuHttpError(404, 'Action not found');
      if (a.actorCellId !== s.localPlayerCellId) throw new LcuHttpError(403, 'Not your action');
      if (a.completed) throw new LcuHttpError(400, 'Action already completed');
      this.completeOwn(a);
      return undefined;
    }
    if (M('PATCH', /^\/lol-champ-select\/v1\/session\/my-selection$/)) {
      if (!this.session) throw new LcuHttpError(404, 'No active delegate');
      const me = this.cell(this.session.localPlayerCellId);
      for (const k of ['spell1Id', 'spell2Id', 'selectedSkinId', 'wardSkinId']) if (body && body[k] !== undefined) me[k] = Number(body[k]);
      this.emitSession();
      return undefined;
    }
    if (M('POST', /^\/lol-champ-select\/v1\/session\/my-selection\/reroll$/)) {
      this.reroll();
      return undefined;
    }
    if ((m = M('POST', /^\/lol-champ-select\/v1\/session\/bench\/swap\/(\d+)$/))) {
      this.benchSwap(Number(m[1]));
      return undefined;
    }
    if ((m = M('POST', /^\/lol-champ-select\/v1\/session\/trades\/(\d+)\/(accept|decline)$/))) {
      this.answerTrade(Number(m[1]), m[2] === 'accept');
      return undefined;
    }
    if (M('GET', /^\/lol-champ-select\/v1\/pickable-champion-ids$/)) return this.pickableIds();
    if (M('GET', /^\/lol-champ-select\/v1\/bannable-champion-ids$/)) return this.bannableIds();

    if (M('GET', /^\/lol-perks\/v1\/pages$/)) return this.perkPages;
    if (M('GET', /^\/lol-perks\/v1\/currentpage$/)) return this.perkPages.find((pg) => pg.id === this.perkCurrentId);
    if (M('PUT', /^\/lol-perks\/v1\/currentpage$/)) {
      const id = Number(body);
      const page = this.perkPages.find((pg) => pg.id === id);
      if (!page) throw new LcuHttpError(404, 'Page not found');
      this.perkCurrentId = id;
      for (const pg of this.perkPages) {
        pg.current = pg.id === id;
        pg.isActive = pg.id === id;
      }
      this.emit('/lol-perks/v1/currentpage', page);
      this.emit('/lol-perks/v1/pages', this.perkPages);
      return undefined;
    }

    if (M('GET', /^\/lol-game-data\/assets\/v1\/champion-summary\.json$/)) return data.CHAMPION_SUMMARY;
    if (M('GET', /^\/lol-game-data\/assets\/v1\/summoner-spells\.json$/)) return data.SPELLS;
    if (M('GET', /^\/lol-game-data\/assets\/v1\/perkstyles\.json$/)) return data.PERK_STYLES;

    throw new LcuHttpError(404, `Not found: ${method} ${p}`);
  }
}

async function startMockLcu(opts = {}) {
  const mock = new MockLcu(opts);
  await mock.start();
  return mock;
}

module.exports = { MockLcu, startMockLcu, QUEUES };

// Tek başına çalıştırma: node mock/mock-lcu.js
if (require.main === module) {
  startMockLcu({ speed: Number(process.env.MOCK_SPEED) || 1 }).then((m) => {
    console.log(`Sahte League istemcisi: http://127.0.0.1:${m.port}  (lockfile: ${m.lockfile})`);
    console.log(`Bağlanmak için: LCU_LOCKFILE="${m.lockfile}" npm start`);
  });
}
