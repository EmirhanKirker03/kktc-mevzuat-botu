// Arama değerlendirmesi (Türkçe ekler ve Türkiye hukuku kısaltmaları): beklenen yasa/tüzük ilk 7 kaynakta mı, ilk sırada mı?
const {chromium}=require('/opt/npm-tools/node_modules/playwright');
const SET=[
['TBK 344. maddeye göre kira artışı TÜFE ile sınırlı mı? KKTC\'de de böyle mi?',['17/1981']],['Konut kirasındaki yıllık artış sınırı nedir?',['17/1981']],
['Kiracının kirasını ödememesi halinde ne olur?',['17/1981']],['Ailenin konutu üzerinde eşlerin hakları nelerdir?',['1/1998']],
['TCK\'daki dolandırıcılık suçunun KKTC karşılığı nedir?',['Fasıl 154']],['HMK\'ya göre cevap dilekçesi süresi KKTC\'de nasıl?',['Tüzük 453']],
['İİK\'daki ihtiyati haciz KKTC\'de nasıl yapılır?',['Fasıl 6','Tüzük 453']],['Borcunu ödemeyen borçlunun malları nasıl haczedilir?',['Fasıl 6','Tüzük 453']],
['Davanın açılmasından sonra davalıya celpname nasıl tebliğ edilir?',['Tüzük 453']],['İşçinin yıllık izni kaç gündür?',['22/1992']],
['Tapudaki kaydın düzeltilmesi için ne yapılır?',['Fasıl 224','11/1978']],['Faizin yasal oranı nedir?',['Fasıl 149','58/2014','33/2010']],
];
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8811/kira_asistani.html'); await p.waitForTimeout(800);
let ok=0, ilk=0, isabet3=0; const kacan=[];
for(const [q,exp] of SET){
  const laws=await p.evaluate(async q=>{ const A=window.__arama; const list=await A.birlesik(q,7); return list.map(a=>A.LAWBY[a.law].no+' | '+A.LAWBY[a.law].kisa+' m.'+a.no+' '+String(a.title).slice(0,40)); },q);
  const iyi=l=>exp.some(e=>l.split(' | ')[0].replace(/\s+/g,' ').replace(/^0+/,'')===e);
  const hit=laws.some(iyi); if(hit) ok++; else kacan.push(q); if(laws[0]&&iyi(laws[0])) ilk++; isabet3+=laws.slice(0,3).filter(iyi).length/3;
  if(process.argv[2]==='v'||!hit) console.log((hit?'✓ ':'✗ ')+q+'\n     '+laws.slice(0,7).join('\n     '));
}
console.log('\nSONUÇ: bulundu '+ok+'/'+SET.length+' · ilk sırada '+ilk+' · ilk 3 isabet %'+Math.round(100*isabet3/SET.length)); if(errs.length) console.log(errs); await b.close();})();
