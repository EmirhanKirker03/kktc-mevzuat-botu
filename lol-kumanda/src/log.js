'use strict';
// Basit, renkli ve saatli konsol günlüğü.

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

const c = {
  dim: paint('2'),
  bold: paint('1'),
  red: paint('31'),
  green: paint('32'),
  yellow: paint('33'),
  blue: paint('34'),
  cyan: paint('36'),
  gold: paint('33;1'),
};

function stamp() {
  return c.dim(new Date().toTimeString().slice(0, 8));
}

function line(tag, args) {
  console.log(`${stamp()} ${tag} ${args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')}`);
}

const debugOn = /^(1|true|yes)$/i.test(process.env.LOLK_DEBUG || '');

// Eski Windows konsolunun yazı tipinde ✓/✗ olmayabilir; her yazı tipinde bulunan √ ve × kullanılır
const legacyConsole = process.platform === 'win32' && !process.env.WT_SESSION;
const OK = legacyConsole ? '√' : '✓';
const ERR = legacyConsole ? '×' : '✗';

const log = {
  info: (...a) => line(c.cyan('•'), a),
  ok: (...a) => line(c.green(OK), a),
  warn: (...a) => line(c.yellow('!'), a),
  error: (...a) => line(c.red(ERR), a),
  debug: (...a) => {
    if (debugOn) line(c.dim('·'), a);
  },
  colors: c,
};

// Testlerde sessiz günlük
const silent = { info() {}, ok() {}, warn() {}, error() {}, debug() {}, colors: c };

module.exports = { log, silent, colors: c };
