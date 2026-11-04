'use strict';
// Türkçe uyumlu arama: "kaisa" → Kai'Sa, "nunu" → Nunu ve Willump, "mf" → Miss Fortune.

const TR_MAP = { ı: 'i', ş: 's', ğ: 'g', ç: 'c', ö: 'o', ü: 'u', â: 'a', î: 'i', û: 'u' };

function normalize(s) {
  return String(s == null ? '' : s)
    .toLocaleLowerCase('tr')
    .replace(/[ışğçöüâîû]/g, (ch) => TR_MAP[ch] || ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Oyuncuların sık kullandığı kısaltmalar → şampiyonun İngilizce takma adı (alias)
const NICKNAMES = {
  mf: 'MissFortune',
  tf: 'TwistedFate',
  j4: 'JarvanIV',
  jarvan: 'JarvanIV',
  lb: 'Leblanc',
  asol: 'AurelionSol',
  gp: 'Gangplank',
  ww: 'Warwick',
  xin: 'XinZhao',
  mundo: 'DrMundo',
  cass: 'Cassiopeia',
  heimer: 'Heimerdinger',
  donger: 'Heimerdinger',
  kass: 'Kassadin',
  malph: 'Malphite',
  morde: 'Mordekaiser',
  noc: 'Nocturne',
  ori: 'Orianna',
  sej: 'Sejuani',
  trynd: 'Tryndamere',
  yi: 'MasterYi',
  ez: 'Ezreal',
  cait: 'Caitlyn',
  blitz: 'Blitzcrank',
  fiddle: 'Fiddlesticks',
  tk: 'TahmKench',
  tahm: 'TahmKench',
  kog: 'KogMaw',
  kha: 'Khazix',
  cho: 'Chogath',
  vel: 'Velkoz',
  rek: 'RekSai',
  wukong: 'MonkeyKing',
  wu: 'MonkeyKing',
  lee: 'LeeSin',
  liss: 'Lissandra',
  naut: 'Nautilus',
  panth: 'Pantheon',
  sera: 'Seraphine',
  voli: 'Volibear',
  renata: 'Renata',
  nunu: 'Nunu',
  bel: 'Belveth',
  kai: 'Kaisa',
  ksante: 'KSante',
  aurelion: 'AurelionSol',
  vlad: 'Vladimir',
  hec: 'Hecarim',
  rammus: 'Rammus',
  shyv: 'Shyvana',
  zil: 'Zilean',
  swain: 'Swain',
  smolder: 'Smolder',
  yumi: 'Yuumi',
};

function initials(name) {
  return String(name || '')
    .split(/[\s'.&-]+/)
    .filter(Boolean)
    .map((w) => normalize(w).charAt(0))
    .join('');
}

/** Bir şampiyon için arama anahtarları (sunucuda bir kez hesaplanır). */
function searchKeys(champ) {
  const keys = new Set();
  const add = (v) => {
    const n = normalize(v);
    if (n) keys.add(n);
  };
  add(champ.name);
  add(champ.alias);
  for (const w of String(champ.name || '').split(/[\s'.&-]+/)) add(w);
  const ini = initials(champ.name);
  if (ini.length >= 2) keys.add(ini);
  for (const [nick, alias] of Object.entries(NICKNAMES)) {
    if (normalize(alias) === normalize(champ.alias)) keys.add(nick);
  }
  return [...keys];
}

/** 0 (eşleşmez) … 100 (tam eşleşme) arası puan. */
function scoreChampion(query, champ) {
  const q = normalize(query);
  if (!q) return 1;
  const name = normalize(champ.name);
  const alias = normalize(champ.alias);
  if (q === name || q === alias) return 100;
  if (NICKNAMES[q] && normalize(NICKNAMES[q]) === alias) return 95;
  if (name.startsWith(q) || alias.startsWith(q)) return 80;
  const keys = champ.keys || searchKeys(champ);
  if (keys.includes(q)) return 75;
  if (keys.some((k) => k.startsWith(q))) return 60;
  if (name.includes(q) || alias.includes(q)) return 40;
  return 0;
}

/** Sorguya göre sıralanmış eşleşmeler. */
function searchChampions(query, champions) {
  return champions
    .map((c) => ({ c, s: scoreChampion(query, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || String(a.c.name).localeCompare(String(b.c.name), 'tr'))
    .map((x) => x.c);
}

/**
 * Yazılan ada karşılık gelen tek şampiyonu bulur.
 * Dönüş: { champion } kesin eşleşmede, { candidates } belirsizse.
 */
function resolveChampion(query, champions) {
  const scored = champions
    .map((c) => ({ c, s: scoreChampion(query, c) }))
    .filter((x) => x.s >= 40)
    .sort((a, b) => b.s - a.s || String(a.c.name).localeCompare(String(b.c.name), 'tr'));
  if (!scored.length) return { champion: null, candidates: [] };
  const top = scored[0];
  const tied = scored.filter((x) => x.s === top.s);
  if (top.s >= 75 && tied.length === 1) return { champion: top.c, candidates: [] };
  // Baştan eşleşenler varsa yalnız onlar önerilir (ör. "lu" → Lucian, Lulu, Lux; "Willump" değil)
  const strong = scored.filter((x) => x.s >= 60);
  const pool = strong.length ? strong : scored;
  if (pool.length === 1 && pool[0].s >= 60) return { champion: pool[0].c, candidates: [] };
  return { champion: null, candidates: pool.slice(0, 8).map((x) => x.c) };
}

module.exports = { normalize, initials, searchKeys, scoreChampion, searchChampions, resolveChampion, NICKNAMES };
