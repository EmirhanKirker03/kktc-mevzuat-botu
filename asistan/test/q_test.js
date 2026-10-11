const {chromium}=require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage();
await p.goto('http://127.0.0.1:8811/kira_asistani.html'); await p.waitForTimeout(800);
for(const q of process.argv.slice(2)){ const r=await p.evaluate(async q=>{ const A=window.__arama; return (await A.birlesik(q,7)).map(a=>A.LAWBY[a.law].kisa+' '+a.no+' '+String(a.title).slice(0,30)); },q); console.log('#',q,'\n  '+r.join('\n  ')); }
await b.close();})();
