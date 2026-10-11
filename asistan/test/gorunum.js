// Tüm bölümler: telefon (390) ve masaüstü, açık ve karanlık tema; yatay taşma ve okunmaz metin denetimi
const {chromium}=require('/opt/npm-tools/node_modules/playwright');
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
for(const [ad,vp,tema] of [['tel-acik',{width:390,height:844},'light'],['tel-koyu',{width:390,height:844},'dark'],['masa-koyu',{width:1280,height:860},'dark']]){
  const c=await b.newContext({viewport:vp,colorScheme:tema}); const p=await c.newPage();
  await p.goto('http://localhost:3100/giris'); await p.fill('input[type=email]','yonetici@test.local'); await p.fill('input[type=password]','yonetici12345'); await p.click('button[type=submit]'); await p.waitForURL('http://localhost:3100/');
  await p.fill('#q','Hüküm aleyhine istinaf süresi nedir?'); await p.click('#ask'); await p.waitForSelector('#answer .acts',{timeout:30000});
  const panes=['pane-ask','pane-taslak','pane-sure','pane-file','pane-kar','pane-ym','pane-rv'];
  for(const pn of panes){
    await p.evaluate(pn=>{ const b=document.querySelector('[data-pane="'+pn+'"],[data-go="'+pn+'"]'); b.click(); },pn); await p.waitForTimeout(pn==='pane-kar'||pn==='pane-ym'?2500:700);
    const g=await p.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}));
    if(g.sw>g.cw+1) console.log('TAŞMA',ad,pn,g);
    await p.screenshot({path:__dirname+'/gor-'+ad+'-'+pn+'.png'});
  }
  await c.close(); }
console.log('bitti'); await b.close(); })();
