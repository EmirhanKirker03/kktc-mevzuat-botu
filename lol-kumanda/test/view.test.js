'use strict';
// Görünüm modeli: şampiyon seçimi oturumundan "sıra kimde, ne yapabilirim" çıkarımı.

const test = require('node:test');
const assert = require('node:assert');
const { deriveChampSelect, flattenActions, buildView, READY_CHECK_SECONDS } = require('../src/game/view');

function player(cellId, team, extra = {}) {
  return {
    cellId,
    team,
    assignedPosition: team === 1 ? ['top', 'jungle', 'middle', 'bottom', 'utility'][cellId % 5] : '',
    championId: 0,
    championPickIntent: 0,
    spell1Id: 4,
    spell2Id: 14,
    nameVisibilityType: 'VISIBLE',
    gameName: `Oyuncu${cellId}`,
    ...extra,
  };
}

function session(actions, extra = {}) {
  return {
    localPlayerCellId: 2,
    myTeam: [0, 1, 2, 3, 4].map((c) => player(c, 1)),
    theirTeam: [5, 6, 7, 8, 9].map((c) => player(c, 2)),
    actions,
    timer: { phase: 'BAN_PICK', adjustedTimeLeftInPhase: 20000, totalTimeInPhase: 30000, isInfinite: false },
    bans: { myTeamBans: [], theirTeamBans: [], numBans: 10 },
    trades: [],
    ...extra,
  };
}

const act = (id, actorCellId, type, o = {}) => ({ id, actorCellId, type, championId: 0, completed: false, isInProgress: false, isAllyAction: actorCellId < 5, ...o });

test('flattenActions dizi dizisini tur sırasıyla düzleştirir', () => {
  const flat = flattenActions([[act(1, 0, 'ban'), act(2, 1, 'ban')], [act(3, 2, 'pick')]]);
  assert.deepStrictEqual(flat.map((a) => [a.id, a.turnIndex]), [[1, 0], [2, 0], [3, 1]]);
  assert.deepStrictEqual(flattenActions(null), []);
});

test('ban sırası bende', () => {
  const s = session([[act(1, 2, 'ban', { isInProgress: true, championId: 157 }), act(2, 5, 'ban', { isInProgress: true })], [act(3, 2, 'pick')]]);
  const cs = deriveChampSelect(s, { sessionAt: 1000, pickable: [1, 2], bannable: [157] });
  assert.strictEqual(cs.my.mode, 'ban');
  assert.strictEqual(cs.my.actionId, 1);
  assert.strictEqual(cs.my.hoverChampionId, 157);
  assert.strictEqual(cs.turn.type, 'ban');
  assert.strictEqual(cs.turn.side, 'both');
  assert.strictEqual(cs.turn.mine, true);
  assert.strictEqual(cs.timer.endsAt, 21000);
  assert.deepStrictEqual(cs.bannable, [157]);
});

test('sıra başkasındayken seçim niyeti (intent) modu ve kalan tur sayısı', () => {
  const s = session([
    [act(1, 2, 'ban', { completed: true, championId: 157 })],
    [act(2, 0, 'pick', { isInProgress: true, championId: 266 })],
    [act(3, 5, 'pick'), act(4, 6, 'pick')],
    [act(5, 1, 'pick'), act(6, 2, 'pick')],
  ]);
  s.myTeam[2].championPickIntent = 103;
  const cs = deriveChampSelect(s, {});
  assert.strictEqual(cs.my.mode, 'intent');
  assert.strictEqual(cs.my.actionId, 6);
  assert.strictEqual(cs.my.actionType, 'pick');
  assert.strictEqual(cs.my.hoverChampionId, 103);
  assert.strictEqual(cs.turnsUntilMine, 2);
  assert.deepStrictEqual(cs.turn, { type: 'pick', side: 'ally', mine: false });
  // Takım arkadaşının işaretlediği (kilitlemediği) şampiyon hover olarak görünür
  const top = cs.allies.find((p) => p.cellId === 0);
  assert.strictEqual(top.locked, false);
  assert.strictEqual(top.hoverId, 266);
  assert.strictEqual(top.acting, 'pick');
  assert.deepStrictEqual(cs.bans.ally, [157]);
});

test('seçim kilitlenince "done" modu ve banlı/alınmış listeleri', () => {
  const s = session([
    [act(1, 2, 'ban', { completed: true, championId: 157 }), act(2, 7, 'ban', { completed: true, championId: 238 })],
    [act(3, 2, 'pick', { completed: true, championId: 103 })],
    [act(4, 5, 'pick', { completed: true, championId: 64 })],
  ]);
  s.myTeam[2].championId = 103;
  s.theirTeam[0].championId = 64;
  const cs = deriveChampSelect(s, {});
  assert.strictEqual(cs.my.mode, 'done');
  assert.strictEqual(cs.my.lockedChampionId, 103);
  assert.deepStrictEqual(cs.bans, { ally: [157], enemy: [238], perTeam: 1 });
  assert.deepStrictEqual(cs.banned.sort(), [157, 238]);
  assert.deepStrictEqual(cs.picked.sort((a, b) => a - b), [64, 103]);
  assert.strictEqual(cs.enemies[0].championId, 64);
  assert.strictEqual(cs.enemies[0].locked, true);
});

test('ARAM: seçim eylemi yokken atanan şampiyon, yedek kulübesi ve zar', () => {
  const s = session([], { benchEnabled: true, benchChampions: [{ championId: 22, isPriority: false }, { championId: 51 }], allowRerolling: true, rerollsRemaining: 2 });
  s.myTeam[2].championId = 99;
  const cs = deriveChampSelect(s, {});
  assert.strictEqual(cs.my.mode, 'done');
  assert.strictEqual(cs.my.lockedChampionId, 99);
  assert.deepStrictEqual(cs.bench, [22, 51]);
  assert.deepStrictEqual(cs.reroll, { remaining: 2 });
});

test('eski biçim: benchChampionIds ve session.bans', () => {
  const s = session([], { benchEnabled: true, benchChampionIds: [1, 2], bans: { myTeamBans: [10], theirTeamBans: [11, 0], numBans: 6 } });
  const cs = deriveChampSelect(s, {});
  assert.deepStrictEqual(cs.bench, [1, 2]);
  assert.deepStrictEqual(cs.bans, { ally: [10], enemy: [11], perTeam: 3 });
});

test('gizli isimler gösterilmez; takas istekleri listelenir', () => {
  const s = session([[act(1, 2, 'pick', { completed: true, championId: 103 })]], {
    trades: [
      { id: 7, cellId: 1, state: 'RECEIVED' },
      { id: 8, cellId: 3, state: 'AVAILABLE' },
    ],
    pickOrderSwaps: [{ id: 9, cellId: 4, state: 'SENT' }],
  });
  s.myTeam[1].nameVisibilityType = 'HIDDEN';
  s.myTeam[1].championId = 64;
  const cs = deriveChampSelect(s, {});
  assert.strictEqual(cs.allies[1].name, '');
  assert.strictEqual(cs.allies[0].name, 'Oyuncu0');
  assert.deepStrictEqual(
    cs.requests.map((r) => [r.kind, r.id, r.state, r.championId, r.position]),
    [
      ['trade', 7, 'RECEIVED', 64, 'jungle'],
      ['pickOrder', 9, 'SENT', 0, 'utility'],
    ],
  );
});

test('son hazırlık aşamasında bekleyen seçim yoksa "wait"', () => {
  const s = session([[act(1, 0, 'pick', { completed: true, championId: 1 })]], { timer: { phase: 'FINALIZATION', adjustedTimeLeftInPhase: 5000 } });
  const cs = deriveChampSelect(s, {});
  assert.strictEqual(cs.my.mode, 'wait');
  assert.strictEqual(cs.phase, 'FINALIZATION');
});

test('buildView: kabul penceresi, sıra, lobi ve sihirdar', () => {
  const now = 1_000_000;
  const raw = {
    phase: 'ReadyCheck',
    gameflow: { gameData: { queue: { id: 420, gameMode: 'CLASSIC', description: 'Ranked Solo/Duo' } } },
    readyCheck: { state: 'InProgress', playerResponse: 'None', timer: 3, declinerIds: [] },
    search: { searchState: 'Searching', timeInQueue: 30, estimatedQueueTime: 90, lowPriorityData: { penaltyTimeRemaining: 0 } },
    searchAt: now,
    lobby: { canStartActivity: true, localMember: { isLeader: true, firstPositionPreference: 'MIDDLE', secondPositionPreference: 'TOP' }, members: [{}, {}], gameConfig: { queueId: 420, showPositionSelector: true } },
    session: null,
    summoner: { gameName: 'Faker', tagLine: 'KR1', profileIconId: 6, summonerLevel: 500 },
    perkPages: [{ id: 5, name: 'A', primaryStyleId: 8100, subStyleId: 8200, current: true }],
    perkCurrentId: null,
  };
  const v = buildView({ raw, statics: { version: 3 }, rcMeta: { id: 'abc', startedAt: now - 3000 }, lcuStatus: 'connected', now });
  assert.strictEqual(v.queueName, 'Dereceli Tek/Çift');
  assert.strictEqual(v.readyCheck.id, 'abc');
  assert.strictEqual(v.readyCheck.endsAt, now - 3000 + READY_CHECK_SECONDS * 1000);
  assert.strictEqual(v.queue.since, now - 30000);
  assert.strictEqual(v.lobby.members, 2);
  assert.deepStrictEqual(v.lobby.positions, ['MIDDLE', 'TOP']);
  assert.strictEqual(v.summoner.name, 'Faker#KR1');
  assert.strictEqual(v.perks.currentId, 5);
  assert.strictEqual(v.staticVersion, 3);
  assert.strictEqual(v.champSelect, null);
});

test('buildView: "Invalid" kabul penceresi gösterilmez', () => {
  const v = buildView({ raw: { phase: 'Lobby', readyCheck: { state: 'Invalid' }, perkPages: [] }, statics: null, now: 1 });
  assert.strictEqual(v.readyCheck, null);
  assert.strictEqual(v.queueName, '');
});
