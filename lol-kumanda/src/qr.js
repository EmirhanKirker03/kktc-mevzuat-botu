'use strict';
// QR kodu: terminalde (yarım blok karakterlerle) ve SVG olarak.

const QRCode = require('qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

function matrix(text) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const rows = [];
  for (let r = 0; r < n; r += 1) {
    const row = [];
    for (let c = 0; c < n; c += 1) row.push(qr.isDark(r, c));
    rows.push(row);
  }
  return rows;
}

/**
 * Koyu zeminli terminal için: açık renkli bloklar "beyaz" modülleri çizer.
 * Her karakter iki satırı temsil eder (▀ ▄ █).
 */
function toTerminal(text, quiet = 2) {
  const m = matrix(text);
  const n = m.length + quiet * 2;
  const dark = (r, c) => {
    const rr = r - quiet;
    const cc = c - quiet;
    if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) return false;
    return m[rr][cc];
  };
  const lines = [];
  for (let r = 0; r < n; r += 2) {
    let line = '';
    for (let c = 0; c < n; c += 1) {
      const top = !dark(r, c); // açık
      const bottom = r + 1 < n ? !dark(r + 1, c) : false;
      if (top && bottom) line += '█';
      else if (top) line += '▀';
      else if (bottom) line += '▄';
      else line += ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function toSvg(text, { size = 280, quiet = 4 } = {}) {
  const m = matrix(text);
  const n = m.length + quiet * 2;
  let path = '';
  m.forEach((row, r) =>
    row.forEach((on, c) => {
      if (on) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

module.exports = { matrix, toTerminal, toSvg };
