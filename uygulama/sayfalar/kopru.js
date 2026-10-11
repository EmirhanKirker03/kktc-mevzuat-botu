// Uygulama sayfası claude.ai içinde de, bu sunucuda da aynı kodla çalışır.
// Bu köprü, sayfanın beklediği window.claude arayüzünü (sample, db, user) sunucunun /api uçlarına bağlar.
(function () {
  'use strict';
  let ben = null;
  const benAl = () => ben || (ben = fetch('/api/ben', { credentials: 'same-origin' }).then(r => { if (r.status === 401) { location.href = '/giris'; throw new Error('oturum'); } return r.json(); }));
  const hata = (kod, mesaj) => Object.assign(new Error(mesaj || kod), { code: kod });

  function jsonCikar(metin) {
    let t = String(metin || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { return JSON.parse(t); } catch (_) {}
    const i = t.indexOf('{'), j = t.lastIndexOf('}');
    if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)); } catch (_) {} }
    throw hata('invalid_json', 'Cevap okunamadı');
  }
  async function sor(istem, opt) {
    const r = await fetch('/api/sor', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ istem: typeof istem === 'string' ? istem : istem.map(m => m.content).join('\n\n') }), signal: opt && opt.signal })
      .catch(e => { throw (e && e.name === 'AbortError') ? hata('cancelled') : hata('upstream', 'Bağlantı sorunu'); });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { if (r.status === 401) location.href = '/giris'; throw hata(j.kod || 'upstream', j.hata); }
    return j.metin || '';
  }
  const sample = async (istem, opt) => ({ text: await sor(istem, opt), truncated: false });
  sample.json = async (istem, opt) => jsonCikar(await sor(istem, opt));
  sample.limits = async () => ({ images: false });

  // inceleme kayıtları: 20 saniyede bir yenilenen ortak liste
  const dinleyiciler = new Set(); let sonListe = [];
  async function yenile() {
    try {
      const r = await fetch('/api/inceleme', { credentials: 'same-origin' }); if (!r.ok) throw new Error(r.status);
      sonListe = await r.json();
      const snap = { docs: sonListe.map(x => ({ id: x.id, data: () => x })) };
      dinleyiciler.forEach(d => d.cb(snap));
    } catch (e) { dinleyiciler.forEach(d => d.err && d.err(e)); }
  }
  setInterval(() => { if (dinleyiciler.size && !document.hidden) yenile(); }, 20000);
  const sorgu = { orderBy() { return sorgu; }, limit() { return sorgu; },
    onSnapshot(cb, err) { const d = { cb, err }; dinleyiciler.add(d); yenile(); return () => dinleyiciler.delete(d); },
    async add(v) { const r = await fetch('/api/inceleme', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) });
      if (!r.ok) throw hata('write_failed', 'Kaydedilemedi'); yenile(); return { id: 'yeni' }; } };
  const dbApi = { collection: () => sorgu, doc: () => ({ get: async () => null }) };

  const userApi = {
    id: async () => (await benAl()).id,
    me: async () => { const b = await benAl(); return { id: b.id, name: b.ad }; },
    isOwner: () => false, canEdit: () => true,
    can: async () => true,
    profiles: async ids => { const o = {}; sonListe.forEach(x => { if (ids.includes(x.kim)) o[x.kim] = { id: x.kim, name: x.kim_ad || '' }; }); return o; },
  };

  window.claude = { use: async ad => ({ sample, db: dbApi, user: userApi })[ad] || null };

  // hesap kutusu: ad, abonelik, kullanım, çıkış
  document.addEventListener('DOMContentLoaded', async () => {
    let b; try { b = await benAl(); } catch (_) { return; }
    const yer = document.querySelector('.sidefoot') || document.body;
    const kutu = document.createElement('div');
    kutu.className = 'hesap';
    kutu.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:12px;border-top:1px solid rgba(255,255,255,.12);padding-top:10px';
    const bitis = b.abonelik_bitis ? b.abonelik_bitis.split('-').reverse().join('.') : '-';
    kutu.innerHTML = '<b style="color:var(--side-ink);font-size:13px"></b><span></span><span></span><span style="display:flex;gap:10px;flex-wrap:wrap"></span>';
    kutu.children[0].textContent = b.ad + (b.buro ? ' · ' + b.buro : '');
    kutu.children[1].textContent = b.rol === 'yonetici' ? 'Yönetici hesabı' : (b.abone ? 'Abonelik: ' + bitis + ' tarihine kadar' : 'Abonelik süresi doldu');
    kutu.children[2].textContent = 'Bugün ' + b.bugun_kullanim + ' / ' + b.gunluk_sinir + ' yapay zekâ isteği';
    if (b.gecici) { const u = document.createElement('div'); u.setAttribute('role', 'alert'); u.style.cssText = 'background:#fbf1dc;color:#5a3b00;padding:10px 16px;font-size:14px;text-align:center';
      u.innerHTML = 'Geçici şifreyle giriş yaptınız. <a href="/hesap?ilk=1" style="color:inherit;font-weight:600">Şifrenizi şimdi değiştirin</a>.'; document.body.prepend(u); }
    const linkler = kutu.children[3];
    const a = (metin, fn) => { const x = document.createElement('a'); x.href = '#'; x.textContent = metin; x.style.color = 'var(--side-ink)'; x.addEventListener('click', e => { e.preventDefault(); fn(); }); linkler.append(x); };
    if (b.rol === 'yonetici') a('Yönetim', () => location.href = '/yonetim');
    a('Şifre', () => location.href = '/hesap');
    a('Koşullar', () => location.href = '/kosullar');
    a('Çıkış', async () => { await fetch('/api/cikis', { method: 'POST' }); location.href = '/giris'; });
    yer.append(kutu);
    const menu = document.getElementById('menu');
    if (menu) {
      const ek = (metin, fn) => { const x = document.createElement('button'); x.type = 'button'; x.textContent = metin; x.addEventListener('click', fn); menu.append(x); };
      if (b.rol === 'yonetici') ek('Yönetim', () => location.href = '/yonetim');
      ek('Şifre değiştir', () => location.href = '/hesap');
      ek('Koşullar', () => location.href = '/kosullar');
      ek('Çıkış (' + b.ad + ')', async () => { await fetch('/api/cikis', { method: 'POST' }); location.href = '/giris'; });
    }
    const ust = document.querySelector('.topbar span');
    if (ust) ust.textContent = b.abone ? b.ad : 'abonelik süresi doldu';
  });
})();
