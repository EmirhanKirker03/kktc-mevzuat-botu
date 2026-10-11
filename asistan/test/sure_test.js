const {chromium}=require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage(); p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://127.0.0.1:8811/kira_asistani.html'); await p.waitForTimeout(800);
const r=await p.evaluate(async()=>{ const A=window.__arama; const list=await A.birlesik('Hüküm aleyhine istinaf süresi nedir?',7); const c=list.find(a=>a.no==='Emir 35 n.2').cid; const S=window.__sureEksik;
 return {dogru:S('Emir 35 uyarınca altı hafta içinde istinaf ihbarnamesi dosyalanır.',[c]), yanlis:S('Emir 35 uyarınca 30 gün içinde istinaf edilir.',[c]), tutar:S('Davacı 125.000 TL ve 3 Mart 2025 tarihinden faiz talep eder, Emir 35 uyarınca.',[c]), oran:S('%9 faiz uygulanır.',[c]), ayrica:S('Ayrıca 14 gün içinde ara emrine itiraz.',[c]), songun:S('Kiranın ödenmesi gereken son günden itibaren bir hafta içinde ödenmezse.',[c]), dorduncu:S('Bu yetki dördüncü ayda kullanılır, on dört gün içinde.',[c])}; });
console.log(r); await b.close();})();
