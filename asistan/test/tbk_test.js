const {chromium}=require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage();
await p.goto('http://127.0.0.1:8811/kira_asistani.html'); await p.waitForTimeout(800);
console.log(await p.evaluate(()=>[...window.__sayi.sayilarIn("TBK 344 Türkiye hukukuna aittir; İİK m.257 ve HMK 127. madde; 30 gün",true)]));
await b.close();})();
