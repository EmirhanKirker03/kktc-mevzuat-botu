const {chromium}=require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage();
await p.goto('http://127.0.0.1:8811/kira_asistani.html'); await p.waitForTimeout(800);
for(const q of process.argv.slice(2)){ const r=await p.evaluate(async q=>{ await window.__arama.birlesik(q,7); const T=await window.__arama.tumDizin(); const h=T.ys.find(y=>y.p==='T7384'); return {son:window.__arama.birlesik.son.concat(['--'],window.__arama.birlesik.son2), kw:h.kw, bs:(h.bs||'').slice(0,200), t:h.t.length}; },q); console.log('#',q); console.log(r.son.join('\n')); console.log('HMUT kw:',r.kw.slice(0,200),'| bs:',r.bs,'| tok',r.t); }
await b.close();})();
