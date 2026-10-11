const {chromium}=require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const errs=[];
for(const [ad,vp] of [['masa',{width:1280,height:820}],['tel',{width:390,height:844}]]){
 const p=await (await b.newContext({viewport:vp})).newPage(); p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:3100/giris'); await p.fill('input[type=email]','yonetici@test.local'); await p.fill('input[type=password]','yonetici12345'); await p.click('button[type=submit]'); await p.waitForURL('http://localhost:3100/'); await p.waitForTimeout(600);
 await p.screenshot({path:'sade-'+ad+'-1.png'});
 await p.fill('#q','Kiracı kirayı ödemezse tahliye istenebilir mi?'); await p.click('#ask'); await p.waitForSelector('#answer .acts',{timeout:30000}); await p.waitForTimeout(400);
 await p.screenshot({path:'sade-'+ad+'-2.png'});
}
console.log(errs); await b.close();})();
