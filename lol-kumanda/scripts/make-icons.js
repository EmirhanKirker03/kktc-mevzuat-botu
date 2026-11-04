'use strict';
// Geliştirici aracı: public/icons/icon.svg'den PNG simgeler üretir (Playwright gerekir).
//   node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const dir = path.join(__dirname, '..', 'public', 'icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
// Kenarları yuvarlatılmamış, tam dolu sürüm (iOS ve "maskable" simgeler kendi maskesini uygular)
const square = svg.replace('rx="112"', 'rx="0"');
const maskable = square.replace(/<path /, '<g transform="translate(51.2 51.2) scale(.8)"><path ').replace(/<\/svg>\s*$/, '</g></svg>');

const jobs = [
  ['icon-192.png', svg, 192],
  ['icon-512.png', svg, 512],
  ['icon-maskable-512.png', maskable, 512],
  ['apple-touch-icon.png', square, 180],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, markup, size] of jobs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
    );
    await page.screenshot({ path: path.join(dir, name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log('yazıldı:', name);
  }
  await browser.close();
})();
