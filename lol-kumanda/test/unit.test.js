'use strict';
// Küçük yardımcıların birim testleri: arama, lockfile/komut satırı, ayarlar, ağ, güvenlik.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { normalize, searchChampions, resolveChampion, searchKeys, scoreChampion } = require('../src/text');
const { parseLockfile, parseCommandLine, toLockfilePath, readInstallPathFromYaml, Discovery } = require('../src/lcu/discovery');
const { Config, tokensEqual, generateToken, sanitize } = require('../src/config');
const { lanAddresses } = require('../src/network');
const { hostAllowed } = require('../src/web/server');
const { stripHtml } = require('../src/telegram/bot');
const { toTerminal, toSvg, matrix } = require('../src/qr');

const CHAMPS = [
  { id: 145, name: "Kai'Sa", alias: 'Kaisa' },
  { id: 20, name: 'Nunu ve Willump', alias: 'Nunu' },
  { id: 21, name: 'Miss Fortune', alias: 'MissFortune' },
  { id: 62, name: 'Wukong', alias: 'MonkeyKing' },
  { id: 420, name: 'Illaoi', alias: 'Illaoi' },
  { id: 59, name: 'Jarvan IV', alias: 'JarvanIV' },
  { id: 4, name: 'Twisted Fate', alias: 'TwistedFate' },
  { id: 236, name: 'Lucian', alias: 'Lucian' },
  { id: 117, name: 'Lulu', alias: 'Lulu' },
  { id: 99, name: 'Lux', alias: 'Lux' },
].map((c) => ({ ...c, keys: searchKeys(c) }));

test('normalize: Türkçe harfler, büyük İ/I ve noktalama', () => {
  assert.strictEqual(normalize("KAİ'SA"), 'kaisa');
  assert.strictEqual(normalize('ILLAOI'), 'illaoi');
  assert.strictEqual(normalize('Şığüçö Dr. Mundo'), 'siguco' + 'drmundo');
  assert.strictEqual(normalize(null), '');
});

test('şampiyon arama: ad, takma ad ve kısaltmalar', () => {
  const first = (q) => (searchChampions(q, CHAMPS)[0] || {}).name;
  assert.strictEqual(first('kaisa'), "Kai'Sa");
  assert.strictEqual(first('mf'), 'Miss Fortune');
  assert.strictEqual(first('tf'), 'Twisted Fate');
  assert.strictEqual(first('j4'), 'Jarvan IV');
  assert.strictEqual(first('wukong'), 'Wukong');
  assert.strictEqual(first('monkey'), 'Wukong');
  assert.strictEqual(first('willump'), 'Nunu ve Willump');
  assert.strictEqual(first('ıllaoi'), 'Illaoi');
  assert.deepStrictEqual(searchChampions('zzz', CHAMPS), []);
  assert.strictEqual(scoreChampion('', CHAMPS[0]), 1);
});

test('resolveChampion: kesin eşleşme ya da aday listesi', () => {
  assert.strictEqual(resolveChampion('Lux', CHAMPS).champion.id, 99);
  assert.strictEqual(resolveChampion('lucian', CHAMPS).champion.id, 236);
  const amb = resolveChampion('lu', CHAMPS);
  assert.strictEqual(amb.champion, null);
  assert.deepStrictEqual(amb.candidates.map((c) => c.name).sort(), ['Lucian', 'Lulu', 'Lux']);
  assert.deepStrictEqual(resolveChampion('qqq', CHAMPS), { champion: null, candidates: [] });
});

test('lockfile ayrıştırma', () => {
  assert.deepStrictEqual(parseLockfile('LeagueClient:1234:54321:Ab-c_d:https\n'), {
    name: 'LeagueClient',
    pid: 1234,
    port: 54321,
    password: 'Ab-c_d',
    protocol: 'https',
  });
  assert.strictEqual(parseLockfile('bozuk'), null);
  assert.strictEqual(parseLockfile('LeagueClient:1:abc:x:https'), null);
});

test('LeagueClientUx komut satırı (Windows ve macOS)', () => {
  const win =
    '"C:/Riot Games/League of Legends/LeagueClientUx.exe" "--riotclient-auth-token=zzz" "--riotclient-app-port=6000" "--remoting-auth-token=AbC123-x_Y" "--app-port=61234" "--install-directory=C:\\Riot Games\\League of Legends" "--app-name=LeagueClient"';
  assert.deepStrictEqual(parseCommandLine(win), {
    port: 61234,
    password: 'AbC123-x_Y',
    protocol: 'https',
    installDir: 'C:\\Riot Games\\League of Legends',
  });
  const mac =
    '/Applications/League of Legends.app/Contents/LoL/LeagueClient.app/Contents/LeagueClientUx.app/Contents/MacOS/LeagueClientUx --remoting-auth-token=tok --app-port=5555 --install-directory=/Applications/League of Legends.app/Contents/LoL --app-name=LeagueClient';
  const m = parseCommandLine(mac);
  assert.strictEqual(m.port, 5555);
  assert.strictEqual(m.password, 'tok');
  assert.strictEqual(m.installDir, '/Applications/League of Legends.app/Contents/LoL');
  assert.strictEqual(parseCommandLine('notepad.exe'), null);
});

test('kurulum yolu yardımcıları', () => {
  assert.strictEqual(toLockfilePath('/Applications/League of Legends.app'), path.join('/Applications/League of Legends.app', 'Contents', 'LoL', 'lockfile'));
  assert.strictEqual(toLockfilePath('/x/lockfile'), '/x/lockfile');
  assert.strictEqual(toLockfilePath(''), null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lolk-yaml-'));
  const yaml = path.join(dir, 'p.yaml');
  fs.writeFileSync(yaml, 'product_install_full_path: "D:/Oyunlar/League of Legends"\nproduct_install_root: "D:/"\n');
  assert.strictEqual(readInstallPathFromYaml(yaml), 'D:/Oyunlar/League of Legends');
  assert.strictEqual(readInstallPathFromYaml(path.join(dir, 'yok.yaml')), null);
});

test('Discovery: ayarda verilen klasördeki lockfile bulunur', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lolk-lf-'));
  fs.writeFileSync(path.join(dir, 'lockfile'), 'LeagueClient:1:4444:sifre:https');
  const d = new Discovery({ leaguePath: dir, scanProcesses: false });
  const c = await d.find();
  assert.strictEqual(c.port, 4444);
  assert.strictEqual(c.password, 'sifre');
  const none = new Discovery({ lockfile: path.join(dir, 'yok') });
  assert.strictEqual(await none.find(), null);
});

test('ayarlar: ilk açılışta anahtar üretilir, bozuk değerler düzeltilir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lolk-cfg-'));
  const file = path.join(dir, 'config.json');
  const c = new Config(file);
  assert.ok(c.isNew);
  assert.match(c.data.token, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  c.update({ autoAccept: true, autoAcceptDelaySec: 99, favorites: { pick: [1, '2', 2, -5, 'x'], ban: null } });
  const again = new Config(file);
  assert.strictEqual(again.isNew, false);
  assert.strictEqual(again.data.token, c.data.token);
  assert.strictEqual(again.data.autoAccept, true);
  assert.strictEqual(again.data.autoAcceptDelaySec, 10);
  assert.deepStrictEqual(again.data.favorites, { pick: [1, 2], ban: [] });
  // Bozuk dosya yedeklenir, yeni ayar oluşturulur
  fs.writeFileSync(file, '{bozuk');
  const fresh = new Config(file);
  assert.ok(fresh.isNew);
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('config.json.bozuk-')));
  assert.deepStrictEqual(sanitize({ port: 'x' }).port, 4747);
});

test('erişim anahtarı karşılaştırması büyük/küçük harf ve tireye duyarsız', () => {
  const t = generateToken();
  assert.ok(tokensEqual(t, t.toUpperCase().replace(/-/g, ' ')));
  assert.ok(!tokensEqual(t, ''));
  assert.ok(!tokensEqual(t, 'abcd-efgh-jkmn'));
});

test('yerel ağ adresi seçimi: Wi-Fi önce, sanal bağdaştırıcılar sona', () => {
  const list = lanAddresses({
    'vEthernet (WSL)': [{ family: 'IPv4', address: '172.20.0.1', internal: false }],
    'Wi-Fi': [{ family: 'IPv4', address: '192.168.1.23', internal: false }, { family: 'IPv6', address: 'fe80::1', internal: false }],
    'VirtualBox Host-Only Network': [{ family: 'IPv4', address: '192.168.56.1', internal: false }],
    Loopback: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
    APIPA: [{ family: 'IPv4', address: '169.254.3.3', internal: false }],
  });
  assert.deepStrictEqual(list.map((a) => a.address), ['192.168.1.23', '172.20.0.1', '192.168.56.1']);
});

test('Host başlığı denetimi (DNS yeniden bağlama koruması)', () => {
  assert.ok(hostAllowed('192.168.1.5:4747'));
  assert.ok(hostAllowed('localhost:4747'));
  assert.ok(hostAllowed('[::1]:4747'));
  assert.ok(hostAllowed(`${os.hostname()}:4747`));
  assert.ok(hostAllowed(undefined));
  assert.ok(!hostAllowed('kotu-site.com:4747'));
  assert.ok(!hostAllowed('192.168.1.5.nip.io:4747'));
});

test('QR kodu ve Telegram HTML temizleme', () => {
  const m = matrix('http://192.168.1.23:4747/?t=abcd-efgh-jkmn');
  assert.ok(m.length >= 21 && m.length === m[0].length);
  assert.ok(toTerminal('test').includes('█'));
  assert.ok(toSvg('test').startsWith('<svg'));
  assert.strictEqual(stripHtml('<b>Ahri</b> &amp; <a href="http://x">aç</a>'), 'Ahri & aç: http://x');
});
