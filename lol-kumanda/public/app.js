/* LoL Kumanda — telefon arayüzü */
(() => {
  'use strict';

  /* ---------- yardımcılar ---------- */
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(`lolk.${k}`);
        return v === null ? d : JSON.parse(v);
      } catch (_) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(`lolk.${k}`, JSON.stringify(v));
      } catch (_) {
        /* gizli sekme vb. */
      }
    },
    del(k) {
      try {
        localStorage.removeItem(`lolk.${k}`);
      } catch (_) {
        /* yoksay */
      }
    },
  };
  const TR_MAP = { ı: 'i', ş: 's', ğ: 'g', ç: 'c', ö: 'o', ü: 'u', â: 'a', î: 'i', û: 'u' };
  const norm = (s) =>
    String(s || '')
      .toLocaleLowerCase('tr')
      .replace(/[ışğçöüâîû]/g, (ch) => TR_MAP[ch] || ch)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '');
  const initials = (name) =>
    String(name || '')
      .split(/[\s'.&-]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  const fmt = (sec) => {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const PHASES = {
    None: 'Ana menü',
    Lobby: 'Lobide',
    Matchmaking: 'Sırada',
    CheckedIntoTournament: 'Turnuva',
    ReadyCheck: 'Maç bulundu',
    ChampSelect: 'Şampiyon seçimi',
    GameStart: 'Oyun başlıyor',
    FailedToLaunch: 'Başlatılamadı',
    InProgress: 'Oyunda',
    Reconnect: 'Yeniden bağlan',
    WaitingForStats: 'Sonuçlar',
    PreEndOfGame: 'Oyun sonu',
    EndOfGame: 'Oyun bitti',
    TerminatedInError: 'Hata',
  };
  const POS = { top: 'Üst', jungle: 'Orman', middle: 'Orta', bottom: 'Alt', utility: 'Destek' };
  const LOBBY_POS = [
    ['TOP', 'Üst'],
    ['JUNGLE', 'Orman'],
    ['MIDDLE', 'Orta'],
    ['BOTTOM', 'Alt'],
    ['UTILITY', 'Destek'],
    ['FILL', 'Fark etmez'],
  ];
  const QUEUES = [
    [420, 'Dereceli Tek/Çift', 'Sıralı · tek ya da ikili'],
    [440, 'Dereceli Esnek', 'Sıralı · grup'],
    [400, 'Seçmeli', 'Normal · ban/seçim'],
    [450, 'ARAM', 'Rastgele şampiyon · tek koridor'],
    [1700, 'Arena', '2v2v2v2'],
  ];
  const ROLES = [
    ['all', 'Tümü'],
    ['fav', '★ Favoriler'],
    ['fighter', 'Savaşçı'],
    ['tank', 'Tank'],
    ['mage', 'Büyücü'],
    ['assassin', 'Suikastçı'],
    ['marksman', 'Nişancı'],
    ['support', 'Destek'],
  ];
  const READY_SECONDS = 12;
  const GAME_PHASES = ['GameStart', 'InProgress', 'Reconnect', 'WaitingForStats', 'PreEndOfGame', 'EndOfGame', 'FailedToLaunch', 'TerminatedInError'];

  /* ---------- durum ---------- */
  const params = new URLSearchParams(location.search);
  let token = params.get('t') || store.get('token', '');
  if (params.get('t')) store.set('token', token);

  const app = {
    view: null,
    statics: null,
    champById: new Map(),
    spellById: new Map(),
    styleById: new Map(),
    staticsVersion: -1,
    loadingStatics: null,
    clockOffset: 0,
    es: null,
    retryTimer: null,
    online: false,
    authNeeded: false,
    screen: null,
    selected: 0,
    selectedAction: null,
    filter: 'all',
    query: '',
    tab: 'champs',
    lastMode: null,
    lastActionId: null,
    gridKey: null,
    spellSlot: 0,
    alarm: null,
    lastRcId: null,
    lastTurnKey: null,
    busy: new Set(),
    prefs: { sound: store.get('sound', true), vibrate: store.get('vibrate', true) },
  };
  const serverNow = () => Date.now() - app.clockOffset;

  /* ---------- sunucu ile iletişim ---------- */
  async function api(path, body) {
    const opts = { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Lolk-Token': token }, cache: 'no-store' };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(path, opts);
    } catch (_) {
      throw new Error('Bilgisayara ulaşılamadı.');
    }
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* gövde yok */
    }
    if (res.status === 401) {
      showAuth(data && data.error);
      throw new Error((data && data.error) || 'Erişim anahtarı geçersiz.');
    }
    if (!res.ok) throw new Error((data && data.error) || `İşlem başarısız (${res.status}).`);
    return data;
  }

  /** Aynı anda tek kopya çalışan işlem; düğme kilitlenir. */
  async function act(type, params, { key = type, silent = false } = {}) {
    if (app.busy.has(key)) return null;
    app.busy.add(key);
    render();
    try {
      const r = await api('/api/action', { type, params });
      if (!silent && r && r.message) toast(r.message, 'ok');
      return r;
    } catch (e) {
      toast(e.message, 'error');
      return null;
    } finally {
      app.busy.delete(key);
      render();
    }
  }

  function connect() {
    clearTimeout(app.retryTimer);
    if (app.es) app.es.close();
    if (app.authNeeded) return;
    const es = new EventSource(`/api/events?t=${encodeURIComponent(token)}`);
    app.es = es;
    es.addEventListener('state', (ev) => {
      if (app.es !== es) return;
      setOnline(true);
      try {
        onState(JSON.parse(ev.data));
      } catch (e) {
        console.error(e);
      }
    });
    es.onopen = () => setOnline(true);
    es.onerror = () => {
      if (app.es !== es) return;
      setOnline(false);
      if (es.readyState === EventSource.CLOSED) {
        es.close();
        app.es = null;
        checkAuthThenRetry();
      }
    };
  }

  async function checkAuthThenRetry() {
    try {
      const r = await fetch(`/api/hello?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.authRequired && !d.authorized) {
        showAuth(token ? 'Anahtar geçersiz. Bilgisayardaki QR kodu yeniden tara.' : '');
        return;
      }
    } catch (_) {
      /* sunucu kapalı */
    }
    app.retryTimer = setTimeout(connect, 2500);
  }

  function setOnline(on) {
    app.online = on;
    $('conn-banner').hidden = on || !app.view || app.authNeeded;
    renderTopbar();
  }

  function showAuth(message) {
    app.authNeeded = true;
    if (app.es) {
      app.es.close();
      app.es = null;
    }
    const err = $('auth-error');
    err.textContent = message || '';
    err.hidden = !message;
    $('conn-banner').hidden = true;
    showScreen('auth');
    renderTopbar();
  }

  $('auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('auth-input').value.trim();
    if (!v) return;
    token = v;
    store.set('token', token);
    app.authNeeded = false;
    history.replaceState(null, '', `?t=${encodeURIComponent(token)}`);
    connect();
  });

  function onState(v) {
    app.clockOffset = Date.now() - v.now;
    const prev = app.view;
    app.view = v;
    if (app.authNeeded) app.authNeeded = false;
    if (v.lcu.status === 'connected' && v.staticVersion > 0 && v.staticVersion !== app.staticsVersion) loadStatics(v.staticVersion);
    alerts(prev, v);
    render();
  }

  async function loadStatics(version) {
    if (app.loadingStatics === version) return;
    app.loadingStatics = version;
    try {
      const s = await api('/api/static');
      for (const c of s.champions) {
        c.n = norm(c.name);
        c.a = norm(c.alias);
      }
      app.statics = s;
      app.staticsVersion = s.version;
      app.champById = new Map(s.champions.map((c) => [c.id, c]));
      app.spellById = new Map(s.spells.map((x) => [x.id, x]));
      app.styleById = new Map(s.perkStyles.map((x) => [x.id, x]));
      app.gridKey = null;
      render();
    } catch (_) {
      app.loadingStatics = null;
    }
  }

  /* ---------- ses ve titreşim ---------- */
  let audio = null;
  function unlockAudio() {
    try {
      if (!audio) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audio = new AC();
      }
      if (audio && audio.state === 'suspended') audio.resume();
    } catch (_) {
      /* ses yok */
    }
  }
  document.addEventListener('pointerdown', unlockAudio, { passive: true });
  document.addEventListener('keydown', unlockAudio);

  function tone(freq, at, dur, type, gain) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(audio.destination);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  function chime(kind) {
    if (!app.prefs.sound || !audio || audio.state !== 'running') return;
    const t = audio.currentTime + 0.01;
    if (kind === 'match') {
      [659.25, 880, 1318.5, 880, 1318.5].forEach((f, i) => tone(f, t + i * 0.13, 0.32, 'triangle', 0.32));
    } else {
      tone(880, t, 0.2, 'sine', 0.25);
      tone(1174.66, t + 0.14, 0.3, 'sine', 0.25);
    }
  }

  function vibrate(pattern) {
    if (!app.prefs.vibrate || !navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch (_) {
      /* desteklenmiyor */
    }
  }

  function startAlarm() {
    stopAlarm();
    const ring = () => {
      chime('match');
      vibrate([400, 120, 400, 120, 700]);
    };
    ring();
    app.alarm = setInterval(ring, 2600);
    document.title = '🔔 MAÇ BULUNDU! — LoL Kumanda';
  }

  function stopAlarm() {
    if (app.alarm) {
      clearInterval(app.alarm);
      app.alarm = null;
      if (navigator.vibrate) {
        try {
          navigator.vibrate(0);
        } catch (_) {
          /* yoksay */
        }
      }
    }
    document.title = 'LoL Kumanda';
  }

  function alerts(prev, v) {
    const rc = v.readyCheck;
    const ringing = rc && rc.state === 'InProgress' && rc.response === 'None';
    if (ringing && rc.id !== app.lastRcId) {
      app.lastRcId = rc.id;
      startAlarm();
    }
    if (!ringing) stopAlarm();
    const cs = v.champSelect;
    const turnKey = cs && (cs.my.mode === 'ban' || cs.my.mode === 'pick') ? `${cs.my.mode}:${cs.my.actionId}` : null;
    if (turnKey && turnKey !== app.lastTurnKey) {
      chime('turn');
      vibrate([200, 90, 200]);
    }
    app.lastTurnKey = turnKey;
  }

  /* ---------- baloncuk ---------- */
  function toast(msg, type = 'info') {
    if (!msg) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), type === 'error' ? 4200 : 2600);
  }

  /* ---------- görseller ---------- */
  const champ = (id) => app.champById.get(id) || null;
  const champName = (id) => (champ(id) ? champ(id).name : id ? `#${id}` : '');
  const champIcon = (id) => (champ(id) ? champ(id).icon : id > 0 ? `/lcu-asset/lol-game-data/assets/v1/champion-icons/${id}.png` : '');
  function picHtml(src, label, cls = '') {
    return `${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async"${cls ? ` class="${cls}"` : ''}>` : ''}<span class="ph">${esc(label || '')}</span>`;
  }
  // Görsel yüklenemezse altındaki baş harf görünür
  document.addEventListener(
    'error',
    (e) => {
      if (e.target && e.target.tagName === 'IMG') e.target.style.visibility = 'hidden';
    },
    true,
  );

  /* ---------- ekranlar ---------- */
  function showScreen(name) {
    if (app.screen === name) return;
    app.screen = name;
    for (const s of ['auth', 'wait', 'home', 'ready', 'cs', 'game']) $(`screen-${s}`).hidden = s !== name;
    window.scrollTo(0, 0);
  }

  function pickScreen(v) {
    if (app.authNeeded) return 'auth';
    if (!v || v.lcu.status !== 'connected') return 'wait';
    const rc = v.readyCheck;
    if (v.phase === 'ReadyCheck' || (rc && rc.state === 'InProgress')) return 'ready';
    if (v.champSelect) return 'cs';
    if (GAME_PHASES.includes(v.phase)) return 'game';
    return 'home';
  }

  function render() {
    const v = app.view;
    const screen = pickScreen(v);
    showScreen(screen);
    renderTopbar();
    document.body.classList.toggle('has-confirm', screen === 'cs' && !$('confirm').hidden);
    if (screen === 'wait') renderWait(v);
    else if (screen === 'home') renderHome(v);
    else if (screen === 'ready') renderReady(v);
    else if (screen === 'cs') renderCs(v);
    else if (screen === 'game') renderGame(v);
    syncSettings();
    tick();
  }

  function renderTopbar() {
    const v = app.view;
    const dot = $('conn-dot');
    let cls = '';
    let text = 'Bağlanıyor…';
    if (app.authNeeded) text = 'Anahtar gerekli';
    else if (!app.online) text = 'Bilgisayar bağlantısı yok';
    else if (!v || v.lcu.status !== 'connected') {
      cls = 'warn';
      text = 'League kapalı';
    } else {
      cls = 'ok';
      text = (v.summoner && v.summoner.name) || PHASES[v.phase] || v.phase;
    }
    dot.className = `conn-dot ${cls}`;
    $('conn-text').textContent = text;
  }

  function renderWait(v) {
    const connecting = v && v.lcu.status === 'connecting';
    $('wait-title').textContent = !app.online && !v ? 'Bilgisayara bağlanılıyor' : connecting ? 'League istemcisine bağlanılıyor' : 'League istemcisi bekleniyor';
    $('wait-text').textContent =
      !app.online && !v
        ? 'LoL Kumanda bilgisayarda çalışıyor mu? Telefon ve bilgisayar aynı Wi-Fi ağında olmalı.'
        : "Bilgisayarda League of Legends'ı aç. Açıldığında buraya kendiliğinden bağlanır.";
  }

  /* ---------- ana ekran ---------- */
  function renderHome(v) {
    const sm = v.summoner;
    $('profile-name').textContent = sm ? sm.name : '—';
    $('profile-level').textContent = sm && sm.level ? `Seviye ${sm.level}` : '';
    const icon = $('profile-icon');
    const iconSrc = sm && sm.iconId ? `/lcu-asset/lol-game-data/assets/v1/profile-icons/${sm.iconId}.jpg` : '';
    if (icon.getAttribute('src') !== iconSrc) {
      icon.style.visibility = '';
      if (iconSrc) icon.setAttribute('src', iconSrc);
      else icon.removeAttribute('src');
    }
    $('profile-ph').textContent = sm ? initials(sm.name) : '';

    const card = $('home-card');
    const key = homeKey(v);
    if (card.dataset.key !== key) {
      card.dataset.key = key;
      card.innerHTML = homeHtml(v);
    }
    $('auto-home').checked = Boolean(v.settings && v.settings.autoAccept);
    $('auto-home-sub').textContent = v.settings && v.settings.autoAccept ? `Açık · ${v.settings.autoAcceptDelaySec} sn sonra kabul eder` : 'Maç bulununca kendiliğinden kabul et';
  }

  function homeKey(v) {
    const l = v.lobby;
    return [v.phase, v.queueId, v.queueName, l && l.isLeader, l && l.canStart, l && l.showPositions, l && l.positions.join(), Boolean(v.queue), app.showQueues, [...app.busy].join()].join('|');
  }

  function homeHtml(v) {
    const busy = (k) => (app.busy.has(k) ? ' disabled' : '');
    if (v.phase === 'Matchmaking' && v.queue) {
      return `<div class="eyebrow">Sırada</div>
        <div class="home-title">${esc(v.queueName || 'Maç aranıyor')}</div>
        <div class="big-timer" id="queue-elapsed">0:00</div>
        <div class="home-sub" id="queue-est"></div>
        <div class="home-actions"><button class="btn btn-ghost" data-act="queue.stop" type="button"${busy('queue.stop')}>Sıradan çık</button></div>`;
    }
    const queueButtons = (current) =>
      `<div class="queue-grid">${QUEUES.map(
        ([id, name, sub]) =>
          `<button class="queue-btn${id === current ? ' current' : ''}" data-queue="${id}" type="button"${busy('lobby.create')}><b>${esc(name)}</b><small>${esc(sub)}</small></button>`,
      ).join('')}</div>`;
    if (!v.lobby) {
      return `<div class="eyebrow">${esc(PHASES[v.phase] || v.phase)}</div>
        <div class="home-title">Lobi kur</div>
        <div class="home-sub">Oyun türünü seç; lobi bilgisayarda açılır.</div>
        ${queueButtons(null)}`;
    }
    const l = v.lobby;
    let html = `<div class="eyebrow">Lobide${l.members > 1 ? ` · ${l.members} kişi` : ''}</div>
      <div class="home-title">${esc(v.queueName || 'Lobi')}</div>`;
    if (l.showPositions && l.isLeader !== undefined) {
      const [p1, p2] = l.positions;
      const row = (label, cur, slot) =>
        `<div class="pos-row"><div class="pos-row-label">${label}</div><div class="pos-chips">${LOBBY_POS.map(
          ([val, name]) => `<button class="pos-chip${cur === val ? ' on' : ''}" data-pos="${slot}:${val}" type="button">${name}</button>`,
        ).join('')}</div></div>`;
      html += row('1. koridor tercihi', p1, 1);
      if (p1 !== 'FILL') html += row('2. koridor tercihi', p2, 2);
    }
    html += '<div class="home-actions">';
    if (l.isLeader) {
      html += `<button class="btn btn-gold" data-act="queue.start" type="button"${busy('queue.start')}${l.canStart ? '' : ' disabled'}>Sıraya gir</button>`;
      if (!l.canStart) html += '<div class="note">Lobi henüz hazır değil (koridor tercihi ya da üyeler bekleniyor).</div>';
    } else {
      html += '<div class="note">Sırayı lobi lideri başlatır.</div>';
    }
    html += `<button class="btn btn-ghost btn-small" data-toggle="queues" type="button">${app.showQueues ? 'Oyun türü listesini gizle' : 'Oyun türünü değiştir'}</button></div>`;
    if (app.showQueues) html += queueButtons(v.queueId);
    return html;
  }

  $('home-card').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act) act(b.dataset.act, {});
    else if (b.dataset.queue) {
      app.showQueues = false;
      act('lobby.create', { queueId: Number(b.dataset.queue) });
    } else if (b.dataset.toggle === 'queues') {
      app.showQueues = !app.showQueues;
      render();
    } else if (b.dataset.pos) {
      const [slot, val] = b.dataset.pos.split(':');
      const l = app.view.lobby;
      let [p1, p2] = l.positions;
      if (slot === '1') {
        if (val === p2) p2 = p1;
        p1 = val;
      } else {
        if (val === p1) p1 = p2;
        p2 = val;
      }
      if (!p1 || p1 === 'UNSELECTED') p1 = 'FILL';
      if (!p2 || p2 === 'UNSELECTED' || p1 === 'FILL') p2 = p1 === 'FILL' ? 'UNSELECTED' : 'FILL';
      act('lobby.positions', { first: p1, second: p2 }, { silent: true });
    }
  });

  /* ---------- maç bulundu ---------- */
  function renderReady(v) {
    const rc = v.readyCheck;
    $('ready-queue').textContent = v.queueName || '';
    const status = $('ready-status');
    const actions = $('ready-actions');
    status.className = 'ready-status';
    let text = '';
    let showButtons = true;
    if (!rc) {
      text = 'Yükleniyor…';
    } else if (rc.state === 'EveryoneReady') {
      text = 'Herkes hazır! Şampiyon seçimine geçiliyor…';
      status.classList.add('ok');
      showButtons = false;
    } else if (rc.state === 'StrangerNotReady' || rc.state === 'PartyNotReady') {
      text = 'Bir oyuncu kabul etmedi. Sıraya geri dönülüyor…';
      status.classList.add('bad');
      showButtons = false;
    } else if (rc.response === 'Accepted') {
      text = '✓ Kabul edildi. Diğer oyuncular bekleniyor…';
      status.classList.add('ok');
      showButtons = false;
    } else if (rc.response === 'Declined') {
      text = 'Maçı reddettin.';
      status.classList.add('bad');
      showButtons = false;
    } else if (rc.autoAcceptAt) {
      text = '⚡ Otomatik kabul edilecek…';
    }
    status.textContent = text;
    actions.hidden = !showButtons;
    $('btn-accept').disabled = app.busy.has('readyCheck.accept');
    $('btn-decline').disabled = app.busy.has('readyCheck.decline');
    $('ready').classList.toggle('alarm', Boolean(app.alarm));
  }

  $('btn-accept').addEventListener('click', () => {
    const rc = app.view && app.view.readyCheck;
    stopAlarm();
    act('readyCheck.accept', { id: rc ? rc.id : undefined }, { silent: true });
  });
  $('btn-decline').addEventListener('click', () => {
    const rc = app.view && app.view.readyCheck;
    stopAlarm();
    act('readyCheck.decline', { id: rc ? rc.id : undefined }, { silent: true });
  });

  /* ---------- oyun ---------- */
  function renderGame(v) {
    const p = v.phase;
    const texts = {
      GameStart: ['⏳', 'Oyun yükleniyor', 'Bilgisayarın başına geç. İyi oyunlar!'],
      InProgress: ['🎮', 'Oyunda', 'İyi oyunlar! Oyun bitince buradan yeniden sıraya girebilirsin.'],
      Reconnect: ['🔌', 'Oyuna yeniden bağlan', 'Oyundan düştün. Bilgisayardan "Yeniden bağlan"a bas.'],
      WaitingForStats: ['📊', 'Sonuçlar bekleniyor', 'Maç bitti, istatistikler hazırlanıyor.'],
      PreEndOfGame: ['🏁', 'Oyun sonu', 'Maç bitti.'],
      EndOfGame: ['🏁', 'Oyun bitti', 'Aynı lobiyle yeniden oynamak için aşağıdaki düğmeye bas.'],
      FailedToLaunch: ['⚠️', 'Oyun başlatılamadı', 'Bilgisayardan kontrol et.'],
      TerminatedInError: ['⚠️', 'Oyun hatayla kapandı', 'Bilgisayardan kontrol et.'],
    };
    const [icon, title, text] = texts[p] || ['🎮', PHASES[p] || p, ''];
    $('game-icon').textContent = icon;
    $('game-title').textContent = title;
    $('game-text').textContent = text;
    const again = $('btn-play-again');
    again.hidden = p !== 'EndOfGame' && p !== 'PreEndOfGame';
    again.disabled = app.busy.has('lobby.playAgain');
  }
  $('btn-play-again').addEventListener('click', () => act('lobby.playAgain', {}));

  /* ---------- şampiyon seçimi ---------- */
  function phaseLabel(cs) {
    if (cs.phase === 'PLANNING') return 'Planlama';
    if (cs.phase === 'FINALIZATION') return 'Son hazırlık';
    if (cs.phase === 'GAME_STARTING') return 'Oyun başlıyor';
    if (cs.bench) return 'ARAM';
    if (cs.turn && cs.turn.type === 'ban') return 'Ban aşaması';
    if (cs.turn && cs.turn.type === 'pick') return 'Seçim aşaması';
    return 'Şampiyon seçimi';
  }

  function turnText(cs) {
    const m = cs.my.mode;
    if (m === 'ban') return ['mine-ban', '<b>Sıra sende!</b> Banlamak istediğin şampiyonu seç.'];
    if (m === 'pick') return ['mine-pick', '<b>Sıra sende!</b> Şampiyonunu seç ve kilitle.'];
    if (cs.phase === 'PLANNING' && m === 'intent') return ['', 'Planlama: oynamak istediğin şampiyonu işaretle (takımın görür).'];
    if (m === 'intent') {
      const n = cs.turnsUntilMine;
      const who = cs.turn ? (cs.turn.side === 'enemy' ? 'Rakip takım' : cs.turn.side === 'both' ? 'Herkes' : 'Takım arkadaşın') : '';
      const act = cs.turn ? (cs.turn.type === 'ban' ? 'banlıyor' : 'seçiyor') : '';
      return ['', `${who ? `${who} ${act}. ` : ''}${n ? `Sıranın gelmesine <b>${n} tur</b> var.` : ''} Şimdiden niyet belirtebilirsin.`];
    }
    if (m === 'done') {
      if (cs.bench) return ['', 'Zar atabilir ya da yedek kulübesinden şampiyon alabilirsin.'];
      if (cs.phase === 'FINALIZATION') return ['', 'Son hazırlık: büyülerini ve rünlerini ayarla.'];
      return ['', `Seçimin kilitlendi: <b>${esc(champName(cs.my.lockedChampionId))}</b>`];
    }
    if (cs.turn) {
      const who = cs.turn.side === 'enemy' ? 'Rakip takım' : cs.turn.side === 'both' ? 'Herkes' : 'Takım arkadaşın';
      return ['', `${who} ${cs.turn.type === 'ban' ? 'banlıyor' : 'seçiyor'}…`];
    }
    return ['', 'Bekleniyor…'];
  }

  function renderCs(v) {
    const cs = v.champSelect;
    const m = cs.my.mode;

    // Sıra değişince seçim sıfırlanır
    if (cs.my.actionId !== app.lastActionId) {
      app.selected = 0;
      app.lastActionId = cs.my.actionId;
    }
    if (m !== app.lastMode) {
      if (app.lastMode === 'ban' && m !== 'ban') setQuery('');
      if (m === 'ban' || m === 'pick') setTab('champs');
      else if (m === 'done' && app.lastMode === 'pick') setTab('loadout');
      app.lastMode = m;
    }

    const head = $('cs-head');
    const [turnCls, turnHtml] = turnText(cs);
    head.className = `cs-head ${turnCls}`;
    $('cs-phase').textContent = phaseLabel(cs);
    const turn = $('cs-turn');
    turn.className = `cs-turn ${turnCls}`;
    turn.innerHTML = turnHtml;

    renderBoard(cs);
    renderRequests(cs);
    renderMine(cs);

    const picking = m === 'ban' || m === 'pick' || m === 'intent';
    $('picker').hidden = !picking || !app.statics;
    $('picker').className = `picker mode-${m}`;
    if (picking && app.statics) renderPicker(cs);
    renderConfirm(cs, picking);
    renderLoadout(v, cs);
    $('tab-btn-champs').classList.toggle('active', app.tab === 'champs');
    $('tab-btn-loadout').classList.toggle('active', app.tab === 'loadout');
    $('tab-champs').hidden = app.tab !== 'champs';
    $('tab-loadout').hidden = app.tab !== 'loadout';
  }

  function slotHtml(p, ally) {
    const id = p.championId || p.hoverId || p.intentId;
    const cls = ['slot'];
    if (p.locked) cls.push('locked');
    else if (p.hoverId) cls.push('hover');
    else if (p.intentId) cls.push('intent');
    if (p.isMe) cls.push('me');
    if (p.acting === 'pick') cls.push('acting');
    if (p.acting === 'ban') cls.push('acting-ban');
    const pos = ally ? (p.isMe ? 'Sen' : POS[p.position] || '') : '';
    const banHover = p.acting === 'ban' && p.banHoverId ? `<span class="slot-ban">${picHtml(champIcon(p.banHoverId), '')}</span>` : '';
    const title = [p.name, champName(id)].filter(Boolean).join(' · ');
    return `<div class="${cls.join(' ')}" title="${esc(title)}">
      <div class="slot-pic">${id ? picHtml(champIcon(id), initials(champName(id))) : `<span class="ph">${ally && p.position ? esc((POS[p.position] || '?')[0]) : ''}</span>`}${banHover}</div>
      <div class="slot-pos${pos ? '' : ' slot-champ'}">${esc(pos || (id ? champName(id) : ''))}</div>
      ${ally && p.name && !p.isMe ? `<div class="slot-name">${esc(p.name)}</div>` : ''}
    </div>`;
  }

  function bansHtml(list, perTeam) {
    const n = Math.max(list.length, Math.min(perTeam || 0, 5));
    let html = '';
    for (let i = 0; i < n; i += 1) {
      const id = list[i];
      html += id ? `<span class="ban-icon" title="${esc(champName(id))}">${picHtml(champIcon(id), '')}</span>` : '<span class="ban-icon empty"></span>';
    }
    return html;
  }

  function setHtml(el, html) {
    if (el.dataset.html !== html) {
      el.dataset.html = html;
      el.innerHTML = html;
    }
  }

  function renderBoard(cs) {
    setHtml($('slots-ally'), cs.allies.map((p) => slotHtml(p, true)).join(''));
    setHtml($('slots-enemy'), cs.enemies.map((p) => slotHtml(p, false)).join(''));
    setHtml($('bans-ally'), bansHtml(cs.bans.ally, cs.bans.perTeam));
    setHtml($('bans-enemy'), bansHtml(cs.bans.enemy, cs.bans.perTeam));
  }

  function renderRequests(cs) {
    const html = cs.requests
      .map((r) => {
        const what = r.kind === 'trade' ? 'şampiyon takası' : r.kind === 'pickOrder' ? 'seçim sırası takası' : 'koridor takası';
        const who = r.position ? `${POS[r.position] || ''} oyuncusu` : 'Bir takım arkadaşın';
        const champTxt = r.championId ? ` (${esc(champName(r.championId))})` : '';
        if (r.state === 'SENT') return `<div class="request"><div class="request-text">↔ ${esc(who)}${champTxt} ile ${what} isteği gönderildi…</div></div>`;
        return `<div class="request"><div class="request-text">↔ <b>${esc(who)}</b>${champTxt} sana ${what} teklif ediyor.</div>
          <div class="row-btns"><button class="btn btn-small btn-gold" data-req="${r.kind}:${r.id}:1" type="button">Kabul</button><button class="btn btn-small btn-ghost" data-req="${r.kind}:${r.id}:0" type="button">Reddet</button></div></div>`;
      })
      .join('');
    setHtml($('cs-requests'), html);
  }
  $('cs-requests').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-req]');
    if (!b) return;
    const [kind, id, yes] = b.dataset.req.split(':');
    act('cs.request', { kind, id: Number(id), accept: yes === '1' });
  });

  function renderMine(cs) {
    const el = $('cs-mine');
    const m = cs.my.mode;
    if (m !== 'done' && m !== 'wait') {
      setHtml(el, '');
      return;
    }
    let html = '';
    const id = cs.my.lockedChampionId;
    if (id) {
      html += `<div class="card"><div class="mine"><span class="mine-pic">${picHtml(champIcon(id), initials(champName(id)))}</span>
        <div><div class="mine-sub">${cs.bench ? 'Şampiyonun' : '✓ Kilitlendi'}</div><div class="mine-name">${esc(champName(id))}</div></div></div>`;
      if (cs.reroll) {
        html += `<div class="bench-actions"><button class="btn btn-small btn-gold" data-mine="reroll" type="button"${cs.reroll.remaining > 0 && !app.busy.has('cs.reroll') ? '' : ' disabled'}>🎲 Zar at (${cs.reroll.remaining})</button></div>`;
      }
      html += '</div>';
    } else {
      html += '<div class="card center muted">Seçim sırası bekleniyor…</div>';
    }
    if (cs.bench) {
      html += `<div class="grid-label">Yedek kulübesi${cs.bench.length ? '' : ' (boş)'}</div><div class="grid" id="bench-grid">${cs.bench
        .map(
          (b) =>
            `<button class="champ" data-bench="${b}" type="button" aria-label="${esc(champName(b))}"><span class="champ-img">${picHtml(champIcon(b), initials(champName(b)))}</span><span class="champ-name">${esc(champName(b))}</span></button>`,
        )
        .join('')}</div>`;
    }
    setHtml(el, html);
  }
  $('cs-mine').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mine === 'reroll') act('cs.reroll', {});
    else if (b.dataset.bench) act('cs.benchSwap', { championId: Number(b.dataset.bench) }, { key: 'cs.benchSwap' });
  });

  /* Şampiyon ızgarası */
  function scoreChamp(q, c) {
    if (q === c.n || q === c.a) return 100;
    if (c.n.startsWith(q) || c.a.startsWith(q)) return 80;
    if (c.keys.includes(q)) return 75;
    if (c.keys.some((k) => k.startsWith(q))) return 60;
    if (c.n.includes(q) || c.a.includes(q)) return 40;
    return 0;
  }

  function kindOf(cs) {
    return cs.my.mode === 'ban' ? 'ban' : 'pick';
  }

  function availability(cs) {
    const kind = kindOf(cs);
    const list = kind === 'ban' ? cs.bannable : cs.pickable;
    const allowed = new Set(list);
    const banned = new Set(cs.banned);
    const picked = new Set(cs.picked);
    const has = list.length > 0;
    return {
      kind,
      banned,
      picked,
      ok: (id) => (has ? allowed.has(id) : !banned.has(id) && !picked.has(id)),
      key: `${kind}:${list.length}:${list.slice(0, 400).join(',')}|${cs.banned.join(',')}|${cs.picked.join(',')}`,
    };
  }

  function tileHtml(c, av, favs) {
    const ok = av.ok(c.id);
    const tag = av.banned.has(c.id) ? '<span class="champ-tag ban">BAN</span>' : av.picked.has(c.id) ? '<span class="champ-tag">ALINDI</span>' : '';
    return `<button class="champ${ok ? '' : ' off'}" data-id="${c.id}" type="button" aria-label="${esc(c.name)}"><span class="champ-img">${picHtml(
      c.icon,
      initials(c.name),
    )}</span><span class="champ-name">${esc(c.name)}</span>${favs.has(c.id) ? '<span class="champ-fav">★</span>' : ''}${ok ? '' : tag}</button>`;
  }

  function renderChips() {
    const html = ROLES.map(([k, label]) => `<button class="chip${app.filter === k ? ' on' : ''}" data-filter="${k}" type="button">${label}</button>`).join('');
    setHtml($('chips'), html);
  }

  function renderPicker(cs) {
    renderChips();
    const av = availability(cs);
    const favList = (app.view.favorites && app.view.favorites[av.kind]) || [];
    const favs = new Set(favList);
    const q = norm(app.query);
    const key = [cs.my.mode, app.filter, q, av.key, favList.join(','), app.staticsVersion].join('#');
    if (key !== app.gridKey) {
      app.gridKey = key;
      const all = app.statics.champions;
      const roleOk = (c) => app.filter === 'all' || app.filter === 'fav' || c.roles.includes(app.filter);
      let list;
      if (q) {
        list = all
          .map((c) => ({ c, s: scoreChamp(q, c) }))
          .filter((x) => x.s > 0 && roleOk(x.c) && (app.filter !== 'fav' || favs.has(x.c.id)))
          .sort((a, b) => av.ok(b.c.id) - av.ok(a.c.id) || b.s - a.s || a.c.name.localeCompare(b.c.name, 'tr'))
          .map((x) => x.c);
      } else if (app.filter === 'fav') {
        list = favList.map((id) => champ(id)).filter(Boolean);
      } else {
        list = all.filter((c) => roleOk(c) && av.ok(c.id));
      }
      const showFavRow = !q && app.filter === 'all' && favList.length > 0;
      const favRow = showFavRow ? favList.map((id) => champ(id)).filter((c) => c && av.ok(c.id)) : [];
      $('fav-label').hidden = !favRow.length;
      $('fav-grid').hidden = !favRow.length;
      $('fav-grid').innerHTML = favRow.map((c) => tileHtml(c, av, favs)).join('');
      const label = q ? `Arama sonuçları (${list.length})` : app.filter === 'fav' ? `Favoriler (${list.length})` : `${av.kind === 'ban' ? 'Banlanabilir' : 'Seçebileceklerin'} (${list.length})`;
      $('all-label').textContent = label;
      $('grid').innerHTML = list.map((c) => tileHtml(c, av, favs)).join('');
      const empty = $('grid-empty');
      empty.hidden = list.length > 0;
      empty.textContent = q
        ? `"${app.query}" ile eşleşen şampiyon yok.`
        : app.filter === 'fav'
        ? 'Henüz favorin yok. Bir şampiyon seçip alttaki ☆ simgesine dokun.'
        : 'Bu filtrede uygun şampiyon yok.';
    }
    const sel = currentSelection(cs);
    for (const el of document.querySelectorAll('#grid .champ, #fav-grid .champ')) {
      const on = Number(el.dataset.id) === sel;
      el.classList.toggle('sel', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  /** Onay çubuğundaki şampiyon: telefonda dokunulan, yoksa istemcide işaretli olan (hâlâ uygunsa). */
  function currentSelection(cs) {
    const av = availability(cs);
    if (app.selected && app.selectedAction === cs.my.actionId && av.ok(app.selected)) return app.selected;
    const hover = cs.my.hoverChampionId || 0;
    return hover && av.ok(hover) ? hover : 0;
  }

  // Hover isteklerini sıraya koy: yalnızca en son seçilen gönderilir
  let hoverBusy = false;
  let hoverNext = null;
  async function sendHover(championId, actionId) {
    hoverNext = { championId, actionId };
    if (hoverBusy) return;
    hoverBusy = true;
    while (hoverNext) {
      const h = hoverNext;
      hoverNext = null;
      try {
        await api('/api/action', { type: 'cs.hover', params: h });
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    hoverBusy = false;
  }

  function onChampTap(e) {
    const b = e.target.closest('.champ[data-id]');
    if (!b) return;
    const cs = app.view && app.view.champSelect;
    if (!cs) return;
    const id = Number(b.dataset.id);
    if (b.classList.contains('off')) {
      const av = availability(cs);
      toast(
        av.banned.has(id) ? `${champName(id)} banlandı.` : av.picked.has(id) ? `${champName(id)} zaten alındı.` : `${champName(id)} şu an ${av.kind === 'ban' ? 'banlanamaz' : 'seçilemez'}.`,
        'error',
      );
      return;
    }
    app.selected = id;
    app.selectedAction = cs.my.actionId;
    render();
    sendHover(id, cs.my.actionId);
  }
  $('grid').addEventListener('click', onChampTap);
  $('fav-grid').addEventListener('click', onChampTap);

  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    app.filter = b.dataset.filter;
    render();
  });

  function setQuery(q) {
    app.query = q;
    const input = $('search');
    if (input.value !== q) input.value = q;
    $('search-clear').hidden = !q;
  }
  $('search').addEventListener('input', (e) => {
    setQuery(e.target.value);
    render();
  });
  $('search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // Aramada ilk uygun sonucu seç
      const first = document.querySelector('#grid .champ:not(.off)');
      if (first) first.click();
      e.target.blur();
    }
  });
  $('search-clear').addEventListener('click', () => {
    setQuery('');
    render();
    $('search').focus();
  });

  function renderConfirm(cs, picking) {
    const bar = $('confirm');
    bar.hidden = !picking || !app.statics || app.tab !== 'champs';
    document.body.classList.toggle('has-confirm', !bar.hidden);
    if (bar.hidden) return;
    const m = cs.my.mode;
    const sel = currentSelection(cs);
    const kind = kindOf(cs);
    const img = $('confirm-img');
    const src = sel ? champIcon(sel) : '';
    if (img.getAttribute('src') !== src) {
      img.style.visibility = '';
      if (src) img.setAttribute('src', src);
      else img.removeAttribute('src');
    }
    $('confirm-ph').textContent = sel ? initials(champName(sel)) : '?';
    $('confirm-label').textContent = m === 'ban' ? 'Banlanacak' : m === 'pick' ? 'Seçilen' : 'Niyetin';
    $('confirm-name').textContent = sel ? champName(sel) : m === 'intent' ? 'Henüz seçmedin' : 'Bir şampiyona dokun';
    const favs = (app.view.favorites && app.view.favorites[kind]) || [];
    const fav = $('btn-fav');
    fav.hidden = !sel;
    fav.textContent = favs.includes(sel) ? '★' : '☆';
    fav.setAttribute('aria-pressed', favs.includes(sel) ? 'true' : 'false');
    fav.setAttribute('aria-label', favs.includes(sel) ? 'Favorilerden çıkar' : 'Favorilere ekle');
    const lock = $('btn-lock');
    lock.className = `btn btn-lock${m === 'ban' ? ' ban' : m === 'intent' ? ' wait' : ''}`;
    lock.textContent = m === 'ban' ? 'Banla' : m === 'pick' ? 'Kilitle' : 'Sıranı bekle';
    lock.disabled = m === 'intent' || !sel || app.busy.has('cs.lock');
  }

  $('btn-lock').addEventListener('click', async () => {
    const cs = app.view && app.view.champSelect;
    if (!cs) return;
    const sel = currentSelection(cs);
    if (!sel) return;
    const r = await act('cs.lock', { championId: sel, actionId: cs.my.actionId });
    if (r) {
      app.selected = 0;
      setQuery('');
    }
  });

  $('btn-fav').addEventListener('click', async () => {
    const cs = app.view && app.view.champSelect;
    if (!cs) return;
    const sel = currentSelection(cs);
    if (!sel) return;
    const kind = kindOf(cs);
    const on = !((app.view.favorites && app.view.favorites[kind]) || []).includes(sel);
    try {
      const r = await api('/api/favorites', { mode: kind, championId: sel, on });
      app.view.favorites = r.favorites;
      toast(on ? `${champName(sel)} ${kind === 'ban' ? 'ban favorilerine' : 'favorilere'} eklendi.` : 'Favorilerden çıkarıldı.', 'ok');
      render();
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  /* Sekmeler */
  function setTab(t) {
    app.tab = t;
    if (t === 'loadout') app.spellSlot = 0;
  }
  for (const b of document.querySelectorAll('.tab')) {
    b.addEventListener('click', () => {
      setTab(b.dataset.tab);
      render();
    });
  }

  /* Büyü ve rün */
  function renderLoadout(v, cs) {
    const mode = v.gameMode || 'CLASSIC';
    const spells = app.statics ? app.statics.spells.filter((s) => !s.modes || !s.modes.length || s.modes.includes(mode)) : [];
    const cur = [cs.my.spell1Id, cs.my.spell2Id];
    const slot = (i) => {
      const sp = app.spellById.get(cur[i]);
      return `<button class="spell-slot${app.spellSlot === i + 1 ? ' on' : ''}" data-slot="${i + 1}" type="button">
        <span class="spell-pic">${picHtml(sp ? sp.icon : '', sp ? sp.name.slice(0, 2) : '?')}</span>
        <span><span class="spell-key">${i === 0 ? 'D' : 'F'}</span><br><span class="spell-name">${esc(sp ? sp.name : 'Seç')}</span></span></button>`;
    };
    setHtml($('spell-slots'), slot(0) + slot(1));
    const list = $('spell-list');
    list.hidden = !app.spellSlot;
    if (app.spellSlot) {
      setHtml(
        list,
        spells
          .map(
            (s) =>
              `<button class="spell-opt${cur[app.spellSlot - 1] === s.id ? ' cur' : ''}" data-spell="${s.id}" type="button"><span class="spell-pic">${picHtml(
                s.icon,
                s.name.slice(0, 2),
              )}</span>${esc(s.name)}</button>`,
          )
          .join('') || '<p class="muted small">Bu modda seçilebilir büyü yok.</p>',
      );
    }
    const pages = v.perks.pages;
    setHtml(
      $('rune-pages'),
      pages.length
        ? pages
            .map((p) => {
              const st = app.styleById.get(p.primary);
              const on = p.id === v.perks.currentId;
              return `<button class="page${on ? ' on' : ''}" data-page="${p.id}" type="button"><span class="page-icon">${picHtml(st ? st.icon : '', '')}</span><span class="page-name">${esc(
                p.name,
              )}${p.valid ? '' : ' <small class="muted">(eksik)</small>'}</span>${on ? '<span class="page-check">✓</span>' : ''}</button>`;
            })
            .join('')
        : '<p class="muted small">Rün sayfası bulunamadı.</p>',
    );
  }
  $('spell-slots').addEventListener('click', (e) => {
    const b = e.target.closest('[data-slot]');
    if (!b) return;
    const s = Number(b.dataset.slot);
    app.spellSlot = app.spellSlot === s ? 0 : s;
    render();
  });
  $('spell-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-spell]');
    const cs = app.view && app.view.champSelect;
    if (!b || !cs || !app.spellSlot) return;
    const id = Number(b.dataset.spell);
    let s1 = cs.my.spell1Id;
    let s2 = cs.my.spell2Id;
    if (app.spellSlot === 1) {
      if (id === s2) s2 = s1;
      s1 = id;
    } else {
      if (id === s1) s1 = s2;
      s2 = id;
    }
    app.spellSlot = 0;
    if (s1 && s2 && s1 !== s2) act('cs.spells', { spell1Id: s1, spell2Id: s2 }, { silent: true });
    else render();
  });
  $('rune-pages').addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (b) act('perks.select', { pageId: Number(b.dataset.page) });
  });

  /* ---------- zamanlayıcılar ---------- */
  function tick() {
    const v = app.view;
    if (!v) return;
    const now = serverNow();
    if (app.screen === 'ready' && v.readyCheck) {
      const left = Math.max(0, (v.readyCheck.endsAt - now) / 1000);
      $('ready-count').textContent = String(Math.ceil(left));
      const frac = Math.min(1, left / READY_SECONDS);
      $('ready-ring').style.strokeDashoffset = String(326.73 * (1 - frac));
      $('ready').classList.toggle('urgent', left <= 4);
    }
    if (app.screen === 'cs' && v.champSelect) {
      const t = v.champSelect.timer;
      const el = $('cs-time');
      if (t.endsAt && !t.infinite) {
        const left = Math.max(0, (t.endsAt - now) / 1000);
        el.textContent = fmt(left);
        el.classList.toggle('urgent', left <= 10 && (v.champSelect.my.mode === 'ban' || v.champSelect.my.mode === 'pick'));
        $('cs-bar').style.width = `${t.total ? Math.min(100, (left * 1000 * 100) / t.total) : 0}%`;
      } else {
        el.textContent = '';
        $('cs-bar').style.width = '0%';
      }
    }
    if (app.screen === 'home' && v.queue) {
      const el = $('queue-elapsed');
      if (el) el.textContent = fmt((now - v.queue.since) / 1000);
      const est = $('queue-est');
      if (est) {
        est.textContent = v.queue.penaltySeconds > 0 ? `Düşük öncelik cezası: ${fmt(v.queue.penaltySeconds)}` : v.queue.estimated ? `Tahmini süre: ${fmt(v.queue.estimated)}` : '';
      }
    }
  }
  setInterval(tick, 250);

  /* ---------- ayarlar ---------- */
  function openSheet() {
    $('sheet').hidden = false;
    $('sheet-backdrop').hidden = false;
    syncSettings(true);
  }
  function closeSheet() {
    $('sheet').hidden = true;
    $('sheet-backdrop').hidden = true;
  }
  $('btn-settings').addEventListener('click', openSheet);
  $('btn-close-sheet').addEventListener('click', closeSheet);
  $('sheet-backdrop').addEventListener('click', closeSheet);
  $('tip-telegram').addEventListener('click', () => {
    openSheet();
    $('tg-section').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('sheet').hidden) closeSheet();
  });

  function syncSettings(force) {
    const v = app.view;
    if (!v || (!force && $('sheet').hidden)) return;
    const s = v.settings || {};
    $('set-auto').checked = Boolean(s.autoAccept);
    if (document.activeElement !== $('set-delay')) $('set-delay').value = String(s.autoAcceptDelaySec || 0);
    $('set-delay-out').textContent = `${$('set-delay').value} sn`;
    $('set-sound').checked = app.prefs.sound;
    $('set-vibrate').checked = app.prefs.vibrate;
    $('app-version').textContent = v.app ? `LoL Kumanda v${v.app.version}` : '';
    renderTelegram(v.telegram || {});
  }

  async function saveSettings(patch) {
    try {
      await api('/api/settings', patch);
    } catch (e) {
      toast(e.message, 'error');
    }
  }
  const setAuto = (on) => {
    if (app.view && app.view.settings) app.view.settings.autoAccept = on;
    saveSettings({ autoAccept: on });
    toast(on ? 'Otomatik kabul açıldı.' : 'Otomatik kabul kapatıldı.', 'ok');
  };
  $('set-auto').addEventListener('change', (e) => setAuto(e.target.checked));
  $('auto-home').addEventListener('change', (e) => setAuto(e.target.checked));
  let delayTimer = null;
  $('set-delay').addEventListener('input', (e) => {
    $('set-delay-out').textContent = `${e.target.value} sn`;
    clearTimeout(delayTimer);
    delayTimer = setTimeout(() => saveSettings({ autoAcceptDelaySec: Number(e.target.value) }), 350);
  });
  $('set-sound').addEventListener('change', (e) => {
    app.prefs.sound = e.target.checked;
    store.set('sound', app.prefs.sound);
  });
  $('set-vibrate').addEventListener('change', (e) => {
    app.prefs.vibrate = e.target.checked;
    store.set('vibrate', app.prefs.vibrate);
  });
  $('btn-test-sound').addEventListener('click', () => {
    unlockAudio();
    setTimeout(() => {
      chime('match');
      vibrate([300, 100, 300]);
      if (!audio) toast('Bu tarayıcı ses çalmayı desteklemiyor.', 'error');
    }, 60);
  });
  $('btn-forget').addEventListener('click', () => {
    store.del('token');
    location.href = '/';
  });

  function renderTelegram(tg) {
    const box = $('tg-status');
    const form = $('tg-form');
    const actions = $('tg-actions');
    let html = '';
    if (!tg.available) {
      html = '<span class="muted">Bu sürümde Telegram desteği yok.</span>';
    } else if (!tg.configured) {
      html = '<span class="muted">Kapalı. Açmak için bot anahtarını gir.</span>';
    } else if (tg.status === 'checking') {
      html = "Telegram'a bağlanılıyor…";
    } else if (tg.status === 'pairing') {
      const link = tg.botName ? `https://t.me/${encodeURIComponent(tg.botName)}?start=${encodeURIComponent(tg.pairCode)}` : '';
      html = `Son adım: ${link ? `<a class="link" href="${esc(link)}" target="_blank" rel="noopener">Telegram'da aç</a> ve <b>Başlat</b>'a bas.` : 'Botuna şu mesajı gönder:'}<br>Ya da botuna şunu yaz: <span class="tg-code">/start ${esc(tg.pairCode)}</span>`;
    } else if (tg.status === 'ready') {
      html = `<span class="ok">✓ Bağlı</span>${tg.botName ? ` · @${esc(tg.botName)}` : ''}`;
    } else if (tg.status === 'error') {
      html = `<span class="bad">${esc(tg.error || 'Hata')}</span>`;
    }
    if (tg.error && tg.status !== 'error') html += `<br><span class="bad small">${esc(tg.error)}</span>`;
    setHtml(box, html);
    form.hidden = tg.configured && tg.status !== 'error';
    actions.hidden = !tg.configured;
    $('btn-tg-test').hidden = tg.status !== 'ready';
    $('btn-tg-unpair').hidden = !tg.paired;
  }
  $('tg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = $('tg-token').value.trim();
    if (!t) return;
    try {
      const r = await api('/api/telegram', { token: t });
      $('tg-token').value = '';
      toast(r.message, 'ok');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  const tgCall = async (body) => {
    try {
      const r = await api('/api/telegram', body);
      toast(r.message, 'ok');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  $('btn-tg-test').addEventListener('click', () => tgCall({ test: true }));
  $('btn-tg-unpair').addEventListener('click', () => tgCall({ unpair: true }));
  $('btn-tg-off').addEventListener('click', () => tgCall({ token: '' }));

  /* ---------- başlangıç ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !app.authNeeded) connect();
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && !app.authNeeded) connect();
  });

  if (!token) {
    // Anahtar istenmiyor olabilir; sunucuya sor
    fetch('/api/hello', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.authRequired && !d.authorized) showAuth('');
        else connect();
      })
      .catch(() => connect());
  } else {
    connect();
  }
  render();
})();
