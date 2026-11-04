'use strict';
// Ayarlarda açıksa, maç bulunduğunda belirlenen gecikmeyle kendiliğinden kabul eder.

function setupAutoAccept({ state, actions, config, log }) {
  let timer = null;

  function cancel() {
    clearTimeout(timer);
    timer = null;
    if (state.rcMeta.autoAcceptAt) {
      state.rcMeta.autoAcceptAt = null;
      state.changed();
    }
  }

  function schedule() {
    clearTimeout(timer);
    const meta = state.rcMeta;
    const rc = state.raw.readyCheck;
    if (!config.data.autoAccept || !meta.active || (rc && rc.playerResponse && rc.playerResponse !== 'None')) return;
    const id = meta.id;
    const delay = Math.max(0, Math.round(config.data.autoAcceptDelaySec * 1000));
    meta.autoAcceptAt = Date.now() + delay;
    state.changed();
    timer = setTimeout(async () => {
      timer = null;
      const cur = state.raw.readyCheck;
      if (!config.data.autoAccept || state.rcMeta.id !== id || !state.rcMeta.active) return;
      if (cur && cur.playerResponse && cur.playerResponse !== 'None') return;
      try {
        await actions.run('readyCheck.accept', { id, auto: true });
      } catch (e) {
        log.warn('Otomatik kabul başarısız:', e.message);
      }
    }, delay);
  }

  state.on('readyCheckStarted', schedule);
  state.on('readyCheckEnded', cancel);

  return {
    /** Ayar değişince çağrılır: açıldıysa bekleyen maçı kabul eder, kapandıysa iptal eder. */
    refresh() {
      if (config.data.autoAccept) {
        if (state.rcMeta.active && !timer) schedule();
      } else {
        cancel();
      }
    },
    cancel,
  };
}

module.exports = { setupAutoAccept };
