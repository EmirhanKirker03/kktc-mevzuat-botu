#!/usr/bin/env node
'use strict';
// LoL Kumanda — League of Legends'ta maç kabulünü ve şampiyon seçimini/banını telefondan yapmak için.
//
// Kullanım:
//   node src/main.js            normal çalışma (League istemcisini kendisi bulur)
//   node src/main.js --demo     League olmadan deneme: sahte bir istemciyle çalışır
//   node src/main.js --port 5000 --no-open
//
// Ortam değişkenleri: PORT, LEAGUE_PATH (kurulum klasörü), LCU_LOCKFILE, LOLK_CONFIG, LOLK_DEBUG=1

const { spawn } = require('child_process');
const { Config } = require('./config');
const { log, colors: c } = require('./log');
const { createApp } = require('./app');
const { toTerminal } = require('./qr');
const pkg = require('../package.json');

function parseArgs(argv) {
  const args = { demo: false, open: null, port: null, lockfile: '', speed: 1, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const [key, inline] = argv[i].split('=');
    const next = () => (inline !== undefined ? inline : argv[++i]);
    if (key === '--demo') args.demo = true;
    else if (key === '--no-open') args.open = false;
    else if (key === '--open') args.open = true;
    else if (key === '--port') args.port = Number(next());
    else if (key === '--lockfile') args.lockfile = next();
    else if (key === '--speed') args.speed = Number(next()) || 1;
    else if (key === '--help' || key === '-h') args.help = true;
  }
  return args;
}

function openBrowser(url) {
  try {
    const opts = { detached: true, stdio: 'ignore', windowsHide: true };
    let child;
    // Boş ilk argüman "start" komutunun pencere başlığıdır (Node bunu "" olarak geçirir)
    if (process.platform === 'win32') child = spawn('cmd', ['/c', 'start', '', url], opts);
    else if (process.platform === 'darwin') child = spawn('open', [url], opts);
    else child = spawn('xdg-open', [url], opts);
    child.on('error', () => {});
    child.unref();
  } catch (_) {
    /* tarayıcı açılamazsa sorun değil */
  }
}

// Tailscale gibi özel VPN'lerin adres aralığı (100.64.0.0/10): telefon başka ağdayken bile erişebilir
const isRemoteUrl = (u) => /^http:\/\/100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(u);

function banner(app, { demo }) {
  const all = app.getUrls();
  const urls = all.filter((u) => !isRemoteUrl(u));
  const remote = all.filter(isRemoteUrl);
  const line = c.dim('─'.repeat(64));
  const out = ['', line, `  ${c.gold('LoL Kumanda')} ${c.dim(`v${pkg.version}`)}${demo ? c.yellow('  [DEMO: sahte istemci]') : ''}`, ''];
  if (urls.length) {
    out.push('  Telefonundan bu adresi aç (bilgisayarla aynı Wi-Fi ağında olmalı):');
    out.push(`    ${c.bold(c.cyan(urls[0]))}`, '');
    out.push(
      toTerminal(urls[0])
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n'),
    );
    out.push('');
    out.push(`  QR kod bozuk görünüyorsa tarayıcıda aç: ${c.cyan(`http://localhost:${app.port}/qr`)}`);
    out.push(
      `  Telefonda sayfa siyah/boş kalıyorsa: Windows Güvenlik Duvarı engelliyordur (League kapalıyken de sayfa açılmalı).`,
      `  Çözüm: README → "Sorun giderme" (güvenlik duvarında program "Node.js JavaScript Runtime" adıyla görünür).`,
    );
    if (urls.length > 1) {
      out.push('  Açılmazsa diğer adresleri dene:');
      for (const u of urls.slice(1, 4)) out.push(`    ${u}`);
    }
  } else {
    out.push(c.yellow('  Yerel ağ adresi bulunamadı. Bilgisayar Wi-Fi ya da kabloyla ağa bağlı mı?'));
  }
  if (remote.length) {
    out.push('', '  Başka ağdan (Tailscale açık telefondan, mobil veriyle de olur):');
    for (const u of remote.slice(0, 2)) out.push(`    ${c.cyan(u)}`);
  }
  out.push('', `  Bu bilgisayarda aç (ayarlar, Telegram kurulumu): ${c.cyan(app.localUrl)}`);
  if (!app.config.data.telegram.token) {
    out.push(`  ${c.dim('Aynı ağda değilken kullanmak için: ayarlardan Telegram bildirimini kur (README → Telegram).')}`);
  }
  out.push('', `  Erişim anahtarı: ${c.bold(app.config.data.token)}   ${c.dim('(adresi kimseyle paylaşma)')}`);
  out.push(`  Ayar dosyası: ${c.dim(app.config.file)}`);
  out.push(`  Kapatmak için: ${c.bold('Ctrl+C')} ya da bu pencereyi kapat.`, line, '');
  console.log(out.join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`LoL Kumanda v${pkg.version}
  --demo         League olmadan sahte istemciyle dene
  --port <n>     web sunucusu portu (varsayılan 4747)
  --no-open      ilk açılışta QR sayfasını tarayıcıda açma
  --open         QR sayfasını her açılışta aç
  --lockfile <f> League lockfile yolunu elle ver`);
    return;
  }

  const config = new Config();
  const port = args.port || Number(process.env.PORT) || config.data.port;
  let lockfile = args.lockfile || process.env.LCU_LOCKFILE || '';
  let mock = null;

  if (args.demo) {
    // eslint-disable-next-line global-require
    const { startMockLcu } = require('../mock/mock-lcu');
    mock = await startMockLcu({ speed: args.speed, log });
    lockfile = mock.lockfile;
    log.info(`Demo modu: sahte League istemcisi ${mock.port} portunda çalışıyor.`);
  }

  let app;
  try {
    app = await createApp({
      config,
      log,
      lockfile,
      leaguePath: process.env.LEAGUE_PATH || config.data.leaguePath,
      port,
    });
  } catch (e) {
    if (e.code === 'EADDRINUSE') {
      log.error(`${port} portu kullanımda. LoL Kumanda zaten açık olabilir; diğer pencereyi kapat ya da config.json içinde "port" değerini değiştir.`);
    } else {
      log.error('Başlatılamadı:', e.stack || e.message);
    }
    if (mock) await mock.close();
    process.exitCode = 1;
    return;
  }

  banner(app, { demo: args.demo });
  if (config.saveError) log.warn(`Ayarlar kaydedilemiyor (${config.saveError.message}); değişiklikler yalnızca bu oturumda geçerli.`);
  if (!args.demo) log.info('League istemcisi aranıyor… (istemci kapalıysa açınca kendiliğinden bağlanır)');

  const shouldOpen = args.open === true || (args.open !== false && (config.isNew || args.demo));
  if (shouldOpen) openBrowser(`http://localhost:${app.port}/qr`);

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    log.info('Kapatılıyor…');
    const force = setTimeout(() => process.exit(0), 3000);
    force.unref();
    await app.close().catch(() => {});
    if (mock) await mock.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGHUP', shutdown);
}

process.on('unhandledRejection', (e) => log.error('Beklenmeyen hata:', e && e.stack ? e.stack : e));

main();
