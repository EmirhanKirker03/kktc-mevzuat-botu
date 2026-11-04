'use strict';
// Bilgisayarın yerel ağ (Wi-Fi / Ethernet) adreslerini bulur; telefonun açacağı adres buradan seçilir.

const os = require('os');

const VIRTUAL = /(vethernet|virtualbox|vmware|vmnet|hyper-v|wsl|docker|vbox|loopback|bluetooth|tailscale|zerotier|hamachi|radmin|utun|awdl|llw|bridge|br-|veth)/i;
const PREFERRED = /(wi-?fi|wlan|wireless|kablosuz|ethernet|^en\d|^eth\d|^wl)/i;

function isPrivate(ip) {
  return /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

function score(name, ip) {
  let s = 0;
  if (/^192\.168\./.test(ip)) s += 30;
  else if (/^10\./.test(ip)) s += 20;
  else if (isPrivate(ip)) s += 10;
  if (PREFERRED.test(name)) s += 20;
  if (VIRTUAL.test(name)) s -= 50;
  if (/^192\.168\.56\./.test(ip)) s -= 40; // VirtualBox host-only
  return s;
}

/** En olası adres önce gelecek şekilde IPv4 adresleri. */
function lanAddresses(ifaces = os.networkInterfaces()) {
  const list = [];
  for (const [name, addrs] of Object.entries(ifaces || {})) {
    for (const a of addrs || []) {
      const v4 = a.family === 'IPv4' || a.family === 4;
      if (!v4 || a.internal || /^169\.254\./.test(a.address)) continue;
      list.push({ name, address: a.address, score: score(name, a.address) });
    }
  }
  return list.sort((x, y) => y.score - x.score);
}

module.exports = { lanAddresses, isPrivate };
