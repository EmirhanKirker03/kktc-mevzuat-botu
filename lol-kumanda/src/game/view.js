'use strict';
// LCU'dan gelen ham veriden telefona gönderilen sade görünüm modelini üretir.
// Buradaki fonksiyonlar saftır (yan etkisiz); birim testleri bu dosyayı sınar.

/** Kabul penceresinin süresi (saniye). İstemci "timer" alanında geçen süreyi verir. */
const READY_CHECK_SECONDS = 12;

const QUEUE_NAMES = {
  0: 'Özel oyun',
  400: 'Normal (Seçmeli)',
  420: 'Dereceli Tek/Çift',
  430: 'Normal (Kör Seçim)',
  440: 'Dereceli Esnek',
  450: 'ARAM',
  480: 'Swiftplay',
  490: 'Hızlı Oyun',
  700: 'Clash',
  720: 'ARAM Clash',
  830: 'Yapay Zekâya Karşı (Giriş)',
  840: 'Yapay Zekâya Karşı (Başlangıç)',
  850: 'Yapay Zekâya Karşı (Orta)',
  870: 'Yapay Zekâya Karşı (Giriş)',
  880: 'Yapay Zekâya Karşı (Başlangıç)',
  890: 'Yapay Zekâya Karşı (Orta)',
  900: 'ARURF',
  1700: 'Arena',
  1710: 'Arena',
  1900: 'URF',
  2400: 'ARAM: Kargaşa',
};

const isPickOrBan = (a) => a && (a.type === 'pick' || a.type === 'ban');

/** session.actions dizi dizisidir (her iç dizi bir tur); düz listeye çevirir, tur sırasını korur. */
function flattenActions(actions) {
  const out = [];
  if (!Array.isArray(actions)) return out;
  actions.forEach((turn, turnIndex) => {
    const list = Array.isArray(turn) ? turn : [turn];
    for (const a of list) if (a && typeof a === 'object') out.push({ ...a, turnIndex });
  });
  return out;
}

/** Yerel oyuncunun seçim/ban eylemleri. */
function myActions(session) {
  if (!session) return [];
  const me = session.localPlayerCellId;
  return flattenActions(session.actions).filter((a) => isPickOrBan(a) && a.actorCellId === me);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function deriveChampSelect(session, ctx = {}) {
  if (!session || typeof session !== 'object' || !Array.isArray(session.myTeam)) return null;
  const me = session.localPlayerCellId;
  const pb = flattenActions(session.actions).filter(isPickOrBan);
  const myTeam = session.myTeam || [];
  const theirTeam = Array.isArray(session.theirTeam) ? session.theirTeam : [];
  const allyCells = new Set(myTeam.map((p) => p.cellId));
  const isAllyAction = (a) => (allyCells.size ? allyCells.has(a.actorCellId) : Boolean(a.isAllyAction));
  const timer = session.timer || {};
  const phase = String(timer.phase || '');

  const mine = pb.filter((a) => a.actorCellId === me);
  const active = mine.find((a) => a.isInProgress && !a.completed) || null;
  const pendingPick = mine.find((a) => a.type === 'pick' && !a.completed) || null;
  const pendingBan = mine.find((a) => a.type === 'ban' && !a.completed) || null;
  const myPicks = mine.filter((a) => a.type === 'pick');
  const meP = myTeam.find((p) => p.cellId === me) || null;

  const donePick = myPicks.find((a) => a.completed && num(a.championId) > 0);
  let lockedChampionId = donePick ? donePick.championId : 0;
  // ARAM gibi seçim eylemi olmayan modlarda şampiyon doğrudan atanır
  if (!lockedChampionId && !myPicks.length && meP && num(meP.championId) > 0) lockedChampionId = meP.championId;

  let mode = 'wait';
  if (active) mode = active.type;
  else if (lockedChampionId) mode = 'done';
  else if (pendingPick && phase !== 'FINALIZATION' && phase !== 'GAME_STARTING') mode = 'intent';

  let hoverChampionId = 0;
  if (active) hoverChampionId = num(active.championId);
  else if (mode === 'intent') hoverChampionId = num(meP && meP.championPickIntent) || num(pendingPick && pendingPick.championId);

  // Banlar
  const bans = { ally: [], enemy: [], perTeam: 0 };
  const banActs = pb.filter((a) => a.type === 'ban');
  if (banActs.length) {
    for (const a of banActs) {
      if (a.completed && num(a.championId) > 0) (isAllyAction(a) ? bans.ally : bans.enemy).push(a.championId);
    }
    bans.perTeam = Math.max(banActs.filter(isAllyAction).length, banActs.filter((a) => !isAllyAction(a)).length);
  } else if (session.bans && typeof session.bans === 'object') {
    bans.ally = (session.bans.myTeamBans || []).filter((id) => num(id) > 0);
    bans.enemy = (session.bans.theirTeamBans || []).filter((id) => num(id) > 0);
    bans.perTeam = Math.floor(num(session.bans.numBans) / 2);
  }

  const player = (p, ally) => {
    const acts = pb.filter((a) => a.actorCellId === p.cellId);
    const picks = acts.filter((a) => a.type === 'pick');
    const current = acts.find((a) => a.isInProgress && !a.completed) || null;
    const pickDone = picks.find((a) => a.completed && num(a.championId) > 0);
    let championId = num(p.championId);
    if (!championId && pickDone) championId = pickDone.championId;
    const locked = picks.length ? Boolean(pickDone) : championId > 0;
    const pickHover = current && current.type === 'pick' ? num(current.championId) : 0;
    const banDone = acts.find((a) => a.type === 'ban' && a.completed && num(a.championId) > 0);
    const visibleName = p.nameVisibilityType !== 'HIDDEN' && p.gameName ? String(p.gameName) : '';
    return {
      cellId: p.cellId,
      isMe: p.cellId === me,
      ally,
      position: String(p.assignedPosition || '').toLowerCase(),
      name: visibleName,
      championId: locked ? championId : 0,
      hoverId: locked ? 0 : pickHover || championId,
      intentId: locked || pickHover || championId ? 0 : num(p.championPickIntent),
      locked,
      acting: current ? current.type : null,
      banHoverId: current && current.type === 'ban' ? num(current.championId) : 0,
      banId: banDone ? banDone.championId : 0,
      spell1Id: ally ? num(p.spell1Id) : 0,
      spell2Id: ally ? num(p.spell2Id) : 0,
    };
  };
  const allies = myTeam.map((p) => player(p, true));
  const enemies = theirTeam.map((p) => player(p, false));

  // Sıra bilgisi
  const inProgress = pb.filter((a) => a.isInProgress && !a.completed);
  let turn = null;
  if (inProgress.length) {
    const allyActing = inProgress.some(isAllyAction);
    const enemyActing = inProgress.some((a) => !isAllyAction(a));
    turn = {
      type: inProgress[0].type,
      side: allyActing && enemyActing ? 'both' : allyActing ? 'ally' : 'enemy',
      mine: Boolean(active),
    };
  }
  // Sırama kaç tur var? (yalnız seçim/ban turları sayılır)
  let turnsUntilMine = null;
  const nextMine = mine.find((a) => !a.completed);
  if (nextMine) {
    const pending = [...new Set(pb.filter((a) => !a.completed).map((a) => a.turnIndex))].sort((x, y) => x - y);
    const idx = pending.indexOf(nextMine.turnIndex);
    turnsUntilMine = idx >= 0 ? idx : null;
  }

  const picked = new Set();
  for (const a of pb) if (a.type === 'pick' && a.completed && num(a.championId) > 0) picked.add(a.championId);
  for (const p of [...allies, ...enemies]) if (p.locked && p.championId) picked.add(p.championId);

  const cellOf = (cellId) => allies.find((x) => x.cellId === cellId) || null;
  const requests = [];
  const addRequests = (arr, kind) => {
    for (const t of Array.isArray(arr) ? arr : []) {
      if (!t || (t.state !== 'RECEIVED' && t.state !== 'SENT')) continue;
      const other = cellOf(t.cellId);
      requests.push({
        kind,
        id: t.id,
        cellId: t.cellId,
        state: t.state,
        championId: other ? other.championId || other.hoverId : 0,
        position: other ? other.position : '',
      });
    }
  };
  addRequests(session.trades, 'trade');
  addRequests(session.pickOrderSwaps, 'pickOrder');
  addRequests(session.positionSwaps, 'position');

  let bench = null;
  if (session.benchEnabled) {
    const raw = Array.isArray(session.benchChampions)
      ? session.benchChampions
      : Array.isArray(session.benchChampionIds)
      ? session.benchChampionIds
      : [];
    bench = raw.map((b) => (typeof b === 'number' ? b : num(b && b.championId))).filter((id) => id > 0);
  }

  const left = Math.max(0, num(timer.adjustedTimeLeftInPhase));
  const sessionAt = ctx.sessionAt || Date.now();

  return {
    phase,
    timer: {
      endsAt: timer.isInfinite ? null : sessionAt + left,
      total: num(timer.totalTimeInPhase),
      infinite: Boolean(timer.isInfinite),
    },
    turn,
    turnsUntilMine,
    my: {
      cellId: me,
      position: meP ? String(meP.assignedPosition || '').toLowerCase() : '',
      mode,
      actionId: active ? active.id : mode === 'intent' && pendingPick ? pendingPick.id : null,
      actionType: active ? active.type : mode === 'intent' ? 'pick' : null,
      hoverChampionId,
      lockedChampionId,
      pendingBan: Boolean(pendingBan),
      pendingPick: Boolean(pendingPick),
      spell1Id: meP ? num(meP.spell1Id) : 0,
      spell2Id: meP ? num(meP.spell2Id) : 0,
    },
    allies,
    enemies,
    bans,
    banned: [...bans.ally, ...bans.enemy],
    picked: [...picked],
    pickable: Array.isArray(ctx.pickable) ? ctx.pickable : [],
    bannable: Array.isArray(ctx.bannable) ? ctx.bannable : [],
    requests,
    bench,
    reroll: session.allowRerolling ? { remaining: num(session.rerollsRemaining) } : null,
    isCustom: Boolean(session.isCustomGame),
    simultaneousBans: Boolean(session.hasSimultaneousBans),
    simultaneousPicks: Boolean(session.hasSimultaneousPicks),
  };
}

function queueInfo(raw) {
  const gfQueue = raw.gameflow && raw.gameflow.gameData && raw.gameflow.gameData.queue;
  const lobbyCfg = raw.lobby && raw.lobby.gameConfig;
  let queueId = null;
  if (gfQueue && Number.isInteger(gfQueue.id) && gfQueue.id >= 0) queueId = gfQueue.id;
  else if (lobbyCfg && Number.isInteger(lobbyCfg.queueId) && lobbyCfg.queueId >= 0) queueId = lobbyCfg.queueId;
  let name = queueId != null && QUEUE_NAMES[queueId] ? QUEUE_NAMES[queueId] : '';
  if (!name && gfQueue) name = gfQueue.description || gfQueue.shortName || gfQueue.name || '';
  if (!name && lobbyCfg && lobbyCfg.isCustom) name = QUEUE_NAMES[0];
  const gameMode = (gfQueue && gfQueue.gameMode) || (lobbyCfg && lobbyCfg.gameMode) || '';
  return { queueId, queueName: name, gameMode };
}

function buildView({ raw, statics, rcMeta = {}, lcuStatus = 'searching', now = Date.now() }) {
  const phase = raw.phase || 'None';
  const { queueId, queueName, gameMode } = queueInfo(raw);

  let readyCheck = null;
  const rc = raw.readyCheck;
  if (rc && rc.state && rc.state !== 'Invalid') {
    readyCheck = {
      state: rc.state,
      response: rc.playerResponse || 'None',
      endsAt: (rcMeta.startedAt || now) + READY_CHECK_SECONDS * 1000,
      id: rcMeta.id || null,
      declined: Array.isArray(rc.declinerIds) ? rc.declinerIds.length : 0,
      autoAcceptAt: rcMeta.autoAcceptAt || null,
    };
  }

  let queue = null;
  const s = raw.search;
  if (s && s.searchState === 'Searching') {
    const low = s.lowPriorityData || {};
    queue = {
      since: (raw.searchAt || now) - num(s.timeInQueue) * 1000,
      estimated: num(s.estimatedQueueTime),
      penaltySeconds: num(low.penaltyTimeRemaining),
    };
  }

  let lobby = null;
  if (raw.lobby && typeof raw.lobby === 'object') {
    const lm = raw.lobby.localMember || {};
    const cfg = raw.lobby.gameConfig || {};
    lobby = {
      isLeader: Boolean(lm.isLeader),
      canStart: raw.lobby.canStartActivity !== false,
      members: Array.isArray(raw.lobby.members) ? raw.lobby.members.length : 1,
      isCustom: Boolean(cfg.isCustom),
      showPositions: Boolean(cfg.showPositionSelector),
      positions: [lm.firstPositionPreference || '', lm.secondPositionPreference || ''],
    };
  }

  let summoner = null;
  if (raw.summoner && typeof raw.summoner === 'object') {
    const sm = raw.summoner;
    summoner = {
      name: sm.gameName ? `${sm.gameName}${sm.tagLine ? `#${sm.tagLine}` : ''}` : sm.displayName || '',
      iconId: num(sm.profileIconId),
      level: num(sm.summonerLevel),
    };
  }

  const pages = (Array.isArray(raw.perkPages) ? raw.perkPages : [])
    .filter((p) => p && p.id != null)
    .map((p) => ({
      id: p.id,
      name: String(p.name || ''),
      primary: num(p.primaryStyleId),
      sub: num(p.subStyleId),
      valid: p.isValid !== false,
    }));
  let currentPageId = raw.perkCurrentId != null ? raw.perkCurrentId : null;
  if (currentPageId == null) {
    const cur = (raw.perkPages || []).find((p) => p && p.current);
    if (cur) currentPageId = cur.id;
  }

  return {
    now,
    lcu: { status: lcuStatus },
    phase,
    queueId,
    queueName,
    gameMode,
    summoner,
    lobby,
    queue,
    readyCheck,
    champSelect: deriveChampSelect(raw.session, { sessionAt: raw.sessionAt, pickable: raw.pickable, bannable: raw.bannable }),
    perks: { pages, currentId: currentPageId },
    staticVersion: statics ? statics.version : 0,
  };
}

module.exports = {
  READY_CHECK_SECONDS,
  QUEUE_NAMES,
  flattenActions,
  myActions,
  isPickOrBan,
  deriveChampSelect,
  buildView,
  queueInfo,
};
