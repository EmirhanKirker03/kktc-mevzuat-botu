const {chromium}=require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage();
await p.goto('http://127.0.0.1:8811/kira_asistani.html'); await p.waitForTimeout(800);
const EX=['Kiracı kirayı ödemezse ne zaman tahliye istenebilir?','Mahkemenin belirlediği yeni kira hangi tarihten geçerli olur?','Boşanmada çocukların velayeti nasıl belirlenir?','İşten haksız çıkarılan işçi hangi tazminatları alabilir?','Ayıplı ürün aldım, satıcıdan neler isteyebilirim?','Alkollü araç kullanmanın cezası nedir?','Depozito ne zaman iade edilmeli?'];
for(const q of EX){ const r=await p.evaluate(async q=>{ const A=window.__arama; const f=(l)=>l.map(a=>A.LAWBY[a.law].kisa+' '+a.no+' '+String(a.title).slice(0,30)); return {eski:f(A.search(q)), yeni:f(await A.birlesik(q,7))}; },q);
 console.log('#',q,'\n eski:',r.eski.join(' | '),'\n yeni:',r.yeni.join(' | ')); }
await b.close();})();
