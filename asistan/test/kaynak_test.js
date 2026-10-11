const {chromium}=require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage(); p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:3100/giris'); await p.fill('input[type=email]','yonetici@test.local'); await p.fill('input[type=password]','yonetici12345'); await p.click('button[type=submit]'); await p.waitForURL('http://localhost:3100/');
console.log('açılış:', await p.$$eval('#sources .mno',e=>e.map(x=>x.textContent)));
await p.fill('#q','Kiracı kirayı ödemezse tahliye istenebilir mi?'); await p.click('#ask'); await p.waitForSelector('#answer .acts',{timeout:30000});
console.log('sonra:', await p.textContent('#srccount'), '| üst:', await p.$$eval('#sources > article .mno',e=>e.map(x=>x.textContent)), '| kapalı:', await p.$$eval('#sources details article',e=>e.length));
await b.close();})();
