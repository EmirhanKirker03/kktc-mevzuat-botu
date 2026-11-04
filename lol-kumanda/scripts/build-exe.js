'use strict';
// Tek dosyalık çalıştırılabilir program üretir (Node.js "Single Executable Application").
// Windows'ta çalıştırılırsa dist/lol-kumanda.exe, Linux/macOS'ta dist/lol-kumanda çıkar.
//
//   npm ci
//   npm run build:exe
//
// Adımlar: arayüz dosyalarını göm → esbuild ile tek JS dosyası → SEA blob → node kopyasına enjekte et.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 12)) {
  console.error(`Node ${process.versions.node} SEA için eski; Node 20.12+ (tercihen 22) gerekir.`);
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// 1) public/ altındaki dosyaları base64 olarak bir modüle göm
const publicDir = path.join(root, 'public');
const assets = {};
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs);
    else assets[path.relative(publicDir, abs).split(path.sep).join('/')] = fs.readFileSync(abs).toString('base64');
  }
})(publicDir);
fs.writeFileSync(path.join(dist, 'assets.js'), `module.exports = ${JSON.stringify(assets)};\n`);
console.log(`• ${Object.keys(assets).length} arayüz dosyası gömüldü`);

// 2) Giriş dosyası
const entry = path.join(dist, 'entry.js');
fs.writeFileSync(
  entry,
  [
    "'use strict';",
    "process.env.WS_NO_BUFFER_UTIL = '1';",
    "process.env.WS_NO_UTF_8_VALIDATE = '1';",
    "globalThis.__LOLK_EMBEDDED__ = require('./assets.js');",
    "require('../src/main.js');",
    '',
  ].join('\n'),
);

// 3) Tek dosya JS
const bundle = path.join(dist, 'lol-kumanda.js');
require('esbuild').buildSync({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: bundle,
  external: ['bufferutil', 'utf-8-validate'],
  legalComments: 'none',
  logLevel: 'warning',
});
console.log(`• Paket: ${(fs.statSync(bundle).size / 1024).toFixed(0)} KB`);

// 4) SEA blob
const blob = path.join(dist, 'sea-prep.blob');
const seaConfig = path.join(dist, 'sea-config.json');
fs.writeFileSync(seaConfig, JSON.stringify({ main: bundle, output: blob, disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false }));
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' });

// 5) Node çalıştırılabilirinin kopyası
const exe = path.join(dist, isWin ? 'lol-kumanda.exe' : 'lol-kumanda');
fs.copyFileSync(process.execPath, exe);
fs.chmodSync(exe, 0o755);

function findSigntool() {
  const base = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  try {
    const versions = fs.readdirSync(base).filter((d) => /^10\./.test(d)).sort().reverse();
    for (const v of versions) {
      const p = path.join(base, v, 'x64', 'signtool.exe');
      if (fs.existsSync(p)) return p;
    }
  } catch (_) {
    /* SDK yok */
  }
  return null;
}

if (isWin) {
  // Node'un imzası enjeksiyondan sonra geçersiz kalacağı için önce kaldırılır (signtool varsa)
  const signtool = findSigntool();
  if (signtool) execFileSync(signtool, ['remove', '/s', exe], { stdio: 'inherit' });
  else console.log('• signtool bulunamadı; imza kaldırılmadan devam ediliyor');
} else if (isMac) {
  execFileSync('codesign', ['--remove-signature', exe], { stdio: 'inherit' });
}

// 6) Blob'u enjekte et
const postject = require.resolve('postject/dist/cli.js');
execFileSync(
  process.execPath,
  [postject, exe, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2', ...(isMac ? ['--macho-segment-name', 'NODE_SEA'] : [])],
  { stdio: 'inherit' },
);
if (isMac) execFileSync('codesign', ['--sign', '-', exe], { stdio: 'inherit' });

for (const f of [entry, blob, seaConfig, path.join(dist, 'assets.js')]) fs.rmSync(f, { force: true });
console.log(`✓ Hazır: ${path.relative(root, exe)} (${(fs.statSync(exe).size / 1024 / 1024).toFixed(1)} MB)`);
