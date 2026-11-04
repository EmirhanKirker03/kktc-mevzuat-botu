'use strict';
// League istemcisinin yerel API bilgilerini (port + şifre) bulur.
//  1) LCU_LOCKFILE ile verilen dosya
//  2) Kurulum klasöründeki "lockfile" (ayar, Riot meta dosyası ya da bilinen yollar)
//  3) Çalışan LeagueClientUx işleminin komut satırı (--app-port, --remoting-auth-token)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

/** lockfile içeriği: "LeagueClient:<pid>:<port>:<şifre>:<protokol>" */
function parseLockfile(text) {
  const parts = String(text || '').trim().split(':');
  if (parts.length < 5) return null;
  const [name, pid, port, password, protocol] = parts;
  if (!/^\d+$/.test(port) || !password) return null;
  return {
    name,
    pid: Number(pid) || 0,
    port: Number(port),
    password,
    protocol: protocol === 'http' ? 'http' : 'https',
  };
}

/** LeagueClientUx komut satırından bağlantı bilgisi çıkarır. */
function parseCommandLine(cmd) {
  const text = String(cmd || '');
  const port = /--app-port=(\d+)/.exec(text);
  const token = /--remoting-auth-token=([^\s"]+)/.exec(text);
  if (!port || !token) return null;
  const dir = /--install-directory=(.+?)(?:"|\s+--|$)/m.exec(text);
  return {
    port: Number(port[1]),
    password: token[1],
    protocol: 'https',
    installDir: dir ? dir[1].trim() : null,
  };
}

/** Riot meta dosyasından kurulum yolunu okur (product_install_full_path). */
function readInstallPathFromYaml(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const m = /product_install_full_path:\s*"?([^"\r\n]+)"?/.exec(text);
    return m ? m[1].trim() : null;
  } catch (_) {
    return null;
  }
}

/** Klasör yolu .app ile bitiyorsa (macOS) lockfile'ın bulunduğu alt klasöre çevirir. */
function toLockfilePath(p) {
  if (!p) return null;
  let dir = String(p).trim().replace(/^"|"$/g, '');
  if (!dir) return null;
  if (/lockfile$/i.test(dir)) return dir;
  if (/\.app\/?$/i.test(dir)) dir = path.join(dir, 'Contents', 'LoL');
  return path.join(dir, 'lockfile');
}

function lockfileCandidates(extraDirs) {
  const dirs = [...extraDirs];
  if (process.platform === 'win32') {
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    for (const product of ['league_of_legends.live', 'league_of_legends.pbe']) {
      const yaml = path.join(programData, 'Riot Games', 'Metadata', product, `${product}.product_settings.yaml`);
      const p = readInstallPathFromYaml(yaml);
      if (p) dirs.push(p);
    }
    for (const drive of ['C', 'D', 'E']) dirs.push(`${drive}:\\Riot Games\\League of Legends`);
    dirs.push('C:\\Program Files\\Riot Games\\League of Legends', 'C:\\Program Files (x86)\\Riot Games\\League of Legends');
  } else if (process.platform === 'darwin') {
    const p = readInstallPathFromYaml(
      '/Users/Shared/Riot Games/Metadata/league_of_legends.live/league_of_legends.live.product_settings.yaml',
    );
    if (p) dirs.push(p);
    dirs.push('/Applications/League of Legends.app');
  } else {
    const home = os.homedir();
    dirs.push(
      path.join(home, 'Games', 'league-of-legends', 'drive_c', 'Riot Games', 'League of Legends'),
      path.join(home, '.wine', 'drive_c', 'Riot Games', 'League of Legends'),
    );
  }
  const out = [];
  for (const d of dirs) {
    const f = toLockfilePath(d);
    if (f && !out.includes(f)) out.push(f);
  }
  return out;
}

function runProcessScan() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // Önce hafif "tasklist" ile istemci açık mı bakılır; PowerShell yalnızca açıksa çalıştırılır
      execFile(
        'tasklist.exe',
        ['/FI', 'IMAGENAME eq LeagueClientUx.exe', '/NH'],
        { windowsHide: true, timeout: 8000, maxBuffer: 256 * 1024 },
        (listErr, list) => {
          if (listErr || !/LeagueClientUx\.exe/i.test(String(list))) {
            resolve('');
            return;
          }
          // -EncodedCommand: tırnak kaçışı derdi olmadan PowerShell komutu
          const script =
            "Get-CimInstance -ClassName Win32_Process -Filter \"Name = 'LeagueClientUx.exe'\" | ForEach-Object { $_.CommandLine }";
          const encoded = Buffer.from(script, 'utf16le').toString('base64');
          execFile(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
            { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 },
            (err, stdout) => resolve(err ? '' : String(stdout)),
          );
        },
      );
    } else {
      execFile('ps', ['-A', '-ww', '-o', 'args='], { timeout: 8000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) =>
        resolve(
          err
            ? ''
            : String(stdout)
                .split('\n')
                .filter((l) => l.includes('LeagueClientUx'))
                .join('\n'),
        ),
      );
    }
  });
}

class Discovery {
  /**
   * @param {object} o
   * @param {string} [o.lockfile]   doğrudan lockfile yolu (demo / test)
   * @param {string} [o.leaguePath] kurulum klasörü
   * @param {boolean} [o.scanProcesses=true]
   */
  constructor({ lockfile = '', leaguePath = '', scanProcesses = true, log } = {}) {
    this.lockfile = lockfile;
    this.leaguePath = leaguePath;
    this.scanProcesses = scanProcesses && !lockfile;
    this.log = log;
    this.knownInstallDir = null;
    this.lastScanAt = 0;
    this.scanIntervalMs = 15000;
    this.candidates = null;
    this.candidatesAt = 0;
    this.installKnown = false;
  }

  // Eşzamansız okuma: bağlantısı kopmuş bir ağ sürücüsü sunucuyu kilitlemesin
  async readLockfile(file) {
    try {
      const creds = parseLockfile(await fs.promises.readFile(file, 'utf8'));
      return creds ? { ...creds, source: file } : null;
    } catch (_) {
      return null;
    }
  }

  async find() {
    if (this.lockfile) return this.readLockfile(this.lockfile);

    const now = Date.now();
    if (!this.candidates || now - this.candidatesAt > 30000) {
      const extra = [];
      if (this.leaguePath) extra.push(this.leaguePath);
      if (this.knownInstallDir) extra.push(this.knownInstallDir);
      this.candidates = lockfileCandidates(extra);
      this.candidatesAt = now;
      // Kurulum klasörü bilinen bir yerdeyse işlem taramasına gerek yok: istemci açılınca lockfile oraya yazılır
      const dirs = await Promise.all(
        this.candidates.map((f) =>
          fs.promises
            .stat(path.dirname(f))
            .then((s) => s.isDirectory())
            .catch(() => false),
        ),
      );
      this.installKnown = dirs.some(Boolean);
    }
    for (const file of this.candidates) {
      const creds = await this.readLockfile(file);
      if (creds) return creds;
    }

    if (!this.scanProcesses || this.installKnown) return null;
    if (Date.now() - this.lastScanAt < this.scanIntervalMs) return null;
    this.lastScanAt = Date.now();
    const out = await runProcessScan();
    for (const lineText of out.split(/\r?\n/)) {
      const creds = parseCommandLine(lineText);
      if (creds) {
        if (creds.installDir && creds.installDir !== this.knownInstallDir) {
          this.knownInstallDir = creds.installDir;
          this.candidates = null; // sonraki aramada bu klasörün lockfile'ı da denensin
        }
        return { ...creds, source: 'process' };
      }
    }
    return null;
  }
}

module.exports = { Discovery, parseLockfile, parseCommandLine, readInstallPathFromYaml, toLockfilePath, lockfileCandidates };
