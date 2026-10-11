const {chromium}=require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage(); p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://127.0.0.1:8811/kira_asistani.html'); await p.waitForTimeout(800);
console.log(await p.evaluate(async()=>{ const A=window.__arama; const l=await A.birlesik('Hüküm aleyhine istinaf süresi nedir?',7); const c=l[0].cid;
 return window.__insanca({limits:'Bkz. '+c+' ve KIRA-7; Y99999-1 bilinmiyor; 27/2011 sayılı', points:[{text:'x '+c, cites:[c]}], cases:[{id:'K12',quote:'KIRA-7 aynen'}]}); }));
await b.close();})();
