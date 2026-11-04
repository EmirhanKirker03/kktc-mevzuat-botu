'use strict';
// Telefondan (ve Telegram'dan) gelen komutları doğrulayıp League istemcisine iletir.

const { flattenActions, isPickOrBan } = require('./view');

class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'UserError';
    this.status = status;
    this.userFacing = true;
  }
}

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

const POSITIONS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY', 'FILL', 'UNSELECTED'];

// Telefondaki "Lobi kur" listesi
const LOBBY_QUEUES = [420, 440, 400, 490, 450, 1700];

class Actions {
  constructor({ lcu, state, config, log }) {
    this.lcu = lcu;
    this.state = state;
    this.config = config;
    this.log = log;
    this.handlers = {
      'readyCheck.accept': (p) => this.acceptReadyCheck(p),
      'readyCheck.decline': (p) => this.declineReadyCheck(p),
      'queue.start': () => this.startQueue(),
      'queue.stop': () => this.stopQueue(),
      'lobby.create': (p) => this.createLobby(p),
      'lobby.positions': (p) => this.setPositions(p),
      'lobby.playAgain': () => this.playAgain(),
      'cs.hover': (p) => this.hover(p),
      'cs.lock': (p) => this.lock(p),
      'cs.spells': (p) => this.setSpells(p),
      'cs.reroll': () => this.reroll(),
      'cs.benchSwap': (p) => this.benchSwap(p),
      'cs.request': (p) => this.answerRequest(p),
      'perks.select': (p) => this.selectPerkPage(p),
    };
  }

  async run(type, params = {}) {
    const fn = this.handlers[type];
    if (!fn) throw new UserError('Bilinmeyen işlem.');
    if (!this.lcu.connected) throw new UserError('League istemcisi açık değil.', 503);
    try {
      return (await fn(params && typeof params === 'object' ? params : {})) || { message: 'Tamam.' };
    } catch (e) {
      if (e.userFacing) throw e;
      if (e.code === 'NOT_CONNECTED') throw new UserError('League istemcisi açık değil.', 503);
      this.log.warn(`İşlem başarısız (${type}):`, e.message);
      throw new UserError(`İstemci işlemi kabul etmedi: ${e.message}`, 502);
    }
  }

  /* ---------- Maç kabul ---------- */

  checkReadyCheck(p) {
    const meta = this.state.rcMeta;
    if (!meta.active && this.state.raw.phase !== 'ReadyCheck') throw new UserError('Şu an kabul edilecek bir maç yok.', 409);
    if (p.id && meta.id && p.id !== meta.id) throw new UserError('Bu maç bildirimi artık geçerli değil.', 409);
  }

  async acceptReadyCheck(p) {
    this.checkReadyCheck(p);
    await this.lcu.post('/lol-matchmaking/v1/ready-check/accept');
    this.log.ok(p.auto ? 'Maç otomatik kabul edildi' : 'Maç kabul edildi');
    return { message: 'Maç kabul edildi.' };
  }

  async declineReadyCheck(p) {
    this.checkReadyCheck(p);
    await this.lcu.post('/lol-matchmaking/v1/ready-check/decline');
    this.log.info('Maç reddedildi');
    return { message: 'Maç reddedildi.' };
  }

  /* ---------- Lobi ve sıra ---------- */

  async startQueue() {
    const lobby = this.state.raw.lobby;
    if (!lobby) throw new UserError('Önce bir lobi kurmalısın.', 409);
    if (lobby.localMember && lobby.localMember.isLeader === false) throw new UserError('Sırayı yalnızca lobi lideri başlatabilir.', 409);
    await this.lcu.post('/lol-lobby/v2/lobby/matchmaking/search');
    this.log.info('Sıraya girildi');
    return { message: 'Sıraya girildi.' };
  }

  async stopQueue() {
    await this.lcu.del('/lol-lobby/v2/lobby/matchmaking/search');
    this.log.info('Sıradan çıkıldı');
    return { message: 'Sıradan çıkıldı.' };
  }

  async createLobby(p) {
    const queueId = toInt(p.queueId);
    if (!LOBBY_QUEUES.includes(queueId)) throw new UserError('Geçersiz oyun türü.');
    const phase = this.state.raw.phase;
    if (!['None', 'Lobby', 'EndOfGame'].includes(phase)) throw new UserError('Şu an lobi kurulamaz.', 409);
    await this.lcu.post('/lol-lobby/v2/lobby', { queueId });
    return { message: 'Lobi kuruldu.' };
  }

  async setPositions(p) {
    const first = String(p.first || '').toUpperCase();
    const second = String(p.second || '').toUpperCase();
    if (!POSITIONS.includes(first) || !POSITIONS.includes(second)) throw new UserError('Geçersiz koridor.');
    await this.lcu.put('/lol-lobby/v2/lobby/members/localMember/position-preferences', {
      firstPreference: first,
      secondPreference: second,
    });
    return { message: 'Koridor tercihleri kaydedildi.' };
  }

  async playAgain() {
    await this.lcu.post('/lol-lobby/v2/play-again');
    return { message: 'Lobiye dönüldü.' };
  }

  /* ---------- Şampiyon seçimi ---------- */

  session() {
    const s = this.state.raw.session;
    if (!s) throw new UserError('Şampiyon seçiminde değilsin.', 409);
    return s;
  }

  checkChampSelect(p) {
    if (p.csId && this.state.cs.id && p.csId !== this.state.cs.id) {
      throw new UserError('Bu bildirim önceki bir şampiyon seçimine ait.', 409);
    }
  }

  /** Bana ait, tamamlanmamış seçim/ban eylemi. actionId verilirse tam o eylem aranır. */
  myAction(actionId) {
    const s = this.session();
    const acts = flattenActions(s.actions).filter(
      (a) => isPickOrBan(a) && a.actorCellId === s.localPlayerCellId && !a.completed,
    );
    let act = null;
    if (actionId !== undefined && actionId !== null && actionId !== '') {
      const id = toInt(actionId);
      act = acts.find((a) => a.id === id) || null;
      if (!act) throw new UserError('Sıra değişti; ekran yenileniyor.', 409);
    } else {
      act = acts.find((a) => a.isInProgress) || acts.find((a) => a.type === 'pick') || null;
    }
    if (!act) throw new UserError('Şu an senin sıran değil.', 409);
    return act;
  }

  checkAvailable(type, championId) {
    if (!this.state.champion(championId) && this.state.statics.loaded) throw new UserError('Şampiyon bulunamadı.');
    const list = type === 'ban' ? this.state.raw.bannable : this.state.raw.pickable;
    if (Array.isArray(list) && list.length && !list.includes(championId)) {
      throw new UserError(
        type === 'ban'
          ? `${this.state.championName(championId)} banlanamaz (zaten banlı ya da seçilmiş).`
          : `${this.state.championName(championId)} seçilemez (sende yok, banlı ya da alınmış).`,
        409,
      );
    }
  }

  async hover(p) {
    this.checkChampSelect(p);
    const championId = toInt(p.championId);
    if (!(championId > 0)) throw new UserError('Şampiyon seçilmedi.');
    const act = this.myAction(p.actionId);
    if (act.type === 'ban' && !act.isInProgress) throw new UserError('Ban sırası henüz gelmedi.', 409);
    this.checkAvailable(act.type, championId);
    await this.lcu.patch(`/lol-champ-select/v1/session/actions/${act.id}`, { championId });
    const name = this.state.championName(championId);
    return {
      actionId: act.id,
      type: act.type,
      intent: !act.isInProgress,
      message: act.isInProgress ? `${name} işaretlendi.` : `Niyet: ${name}`,
    };
  }

  async lock(p) {
    this.checkChampSelect(p);
    const act = this.myAction(p.actionId);
    if (!act.isInProgress) {
      throw new UserError(act.type === 'ban' ? 'Ban sırası henüz gelmedi.' : 'Seçim sırası henüz gelmedi.', 409);
    }
    const championId = toInt(p.championId) > 0 ? toInt(p.championId) : Number(act.championId) || 0;
    if (!(championId > 0)) throw new UserError('Önce bir şampiyon seç.');
    this.checkAvailable(act.type, championId);
    const url = `/lol-champ-select/v1/session/actions/${act.id}`;
    await this.lcu.patch(url, { championId });
    try {
      await this.lcu.post(`${url}/complete`);
    } catch (e) {
      // Bazı sürümlerde /complete yerine PATCH { completed: true } kullanılır
      if (e.status === 404 || e.status === 405) await this.lcu.patch(url, { championId, completed: true });
      else throw e;
    }
    const name = this.state.championName(championId);
    this.log.ok(act.type === 'ban' ? `Banlandı: ${name}` : `Kilitlendi: ${name}`);
    return {
      actionId: act.id,
      type: act.type,
      championId,
      message: act.type === 'ban' ? `${name} banlandı.` : `${name} kilitlendi.`,
    };
  }

  async setSpells(p) {
    this.session();
    const spell1Id = toInt(p.spell1Id);
    const spell2Id = toInt(p.spell2Id);
    if (!(spell1Id > 0) || !(spell2Id > 0) || spell1Id === spell2Id) throw new UserError('Geçersiz büyü seçimi.');
    await this.lcu.patch('/lol-champ-select/v1/session/my-selection', { spell1Id, spell2Id });
    return { message: 'Büyüler güncellendi.' };
  }

  async reroll() {
    const s = this.session();
    if (!s.allowRerolling) throw new UserError('Bu modda zar atılamaz.', 409);
    await this.lcu.post('/lol-champ-select/v1/session/my-selection/reroll');
    return { message: 'Zar atıldı.' };
  }

  async benchSwap(p) {
    const s = this.session();
    const championId = toInt(p.championId);
    if (!s.benchEnabled) throw new UserError('Bu modda yedek kulübesi yok.', 409);
    if (!(championId > 0)) throw new UserError('Şampiyon seçilmedi.');
    await this.lcu.post(`/lol-champ-select/v1/session/bench/swap/${championId}`);
    return { message: `${this.state.championName(championId)} alındı.` };
  }

  async answerRequest(p) {
    this.session();
    const id = toInt(p.id);
    if (!(id >= 0)) throw new UserError('Geçersiz istek.');
    const base = {
      trade: '/lol-champ-select/v1/session/trades',
      pickOrder: '/lol-champ-select/v1/session/swaps',
      position: '/lol-champ-select/v1/session/position-swaps',
    }[p.kind];
    if (!base) throw new UserError('Geçersiz istek türü.');
    await this.lcu.post(`${base}/${id}/${p.accept ? 'accept' : 'decline'}`);
    return { message: p.accept ? 'Takas kabul edildi.' : 'Takas reddedildi.' };
  }

  async selectPerkPage(p) {
    const pageId = toInt(p.pageId);
    const pages = this.state.raw.perkPages || [];
    if (!pages.some((pg) => pg && pg.id === pageId)) throw new UserError('Rün sayfası bulunamadı.');
    await this.lcu.put('/lol-perks/v1/currentpage', pageId);
    return { message: 'Rün sayfası seçildi.' };
  }
}

module.exports = { Actions, UserError, LOBBY_QUEUES, POSITIONS };
