const {chromium}=require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage(); p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://127.0.0.1:8811/kira_asistani.html'); await p.waitForTimeout(800);
const r=await p.evaluate(async()=>{ const A=window.__arama; const list=await A.birlesik('Hüküm aleyhine istinaf süresi nedir?',7); const c=list.find(a=>/^Emir/.test(a.no)).cid;
 const V=A.verify||window.__verify; if(!V) return 'verify yok';
 const t=(s)=>V({summary:s,points:[{text:'x',cites:[c]}]},list).unknown;
 return {dogru:t('HMUT Emir 35 nizam 2 uyarınca'), dogru2:t('Emir 1(B) nizam 2(6)'), dogru3:t('E.35 n.3'), yanlis:t('Emir 99 nizam 3'), yanlis2:t('Emir 35 nizam 47')}; });
console.log(r); await b.close();})();
