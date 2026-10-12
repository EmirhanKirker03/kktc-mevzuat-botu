const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('http://127.0.0.1:8811/kira_asistani.html');await p.waitForTimeout(800);
const r=await p.evaluate(async q=>{const A=window.__arama;const l=await A.birlesik(q);return {son:A.birlesik.son,arts:l.slice(0,10).map(a=>A.LAWBY[a.law].no+' m.'+a.no)}},process.argv[2]);console.log(JSON.stringify(r,null,1));await b.close();})();
