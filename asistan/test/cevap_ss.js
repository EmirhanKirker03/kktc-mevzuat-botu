const {chromium}=require('playwright');const D=process.argv[2];
(async()=>{const b=await chromium.launch();
for(const [ad,vp] of [['masa',{width:1366,height:900}],['tel',{width:390,height:844}]]){
const p=await b.newPage({viewport:vp});await p.goto('http://localhost:3100/giris');await p.fill('input[type=email]','yonetici@test.local');await p.fill('input[type=password]','yonetici12345');await p.click('button[type=submit]');await p.waitForURL('http://localhost:3100/');await p.waitForTimeout(800);
await p.fill('#q','Kiracı 3 aydır kira ödemiyor, tahliye isteyebilir miyim?');await p.click('#ask');await p.waitForSelector('#answer .acts',{timeout:30000});await p.waitForTimeout(800);
await p.screenshot({path:D+'/cevap_'+ad+'.png',fullPage:true});
const t=await p.evaluate(()=>({rozet:[...document.querySelectorAll('#answer .badge,.badge')].filter(e=>e.offsetParent).map(e=>e.textContent.trim()).slice(0,20),dugme:[...document.querySelectorAll('#answer button,#answer a')].filter(e=>e.offsetParent).map(e=>e.textContent.trim()).filter(Boolean)}));console.log(ad,JSON.stringify(t));await p.close();}
await b.close();})();
