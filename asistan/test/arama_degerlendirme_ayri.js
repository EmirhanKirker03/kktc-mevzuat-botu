// arama değerlendirmesi: beklenen yasa ilk 8 kaynakta mı?
const {chromium}=require('playwright');
const SET=[
['Kamu arazisi kiralanabilir mi, kira süresi ne kadardır?',['53/1989','19/2003']],['Banka kredi kartı limitini kim belirler?',['58/2014']],
['Avukat katibi kimdir, nasıl kaydolur?',['Fasıl 3']],['Antika eser bulan kişi ne yapmalıdır?',['Fasıl 31']],
['Bilişim sistemine izinsiz girmenin cezası nedir?',['32/2020']],['Gelir vergisi beyannamesi ne zaman verilir?',['24/1982']],
['Hayvan refahı için sahibinin yükümlülükleri nelerdir?',['8/2013']],['Elektronik haberleşme hizmetleri için yetkilendirme nasıl alınır?',['6/2012']],
['Şirket müdürlerinin sorumlulukları nelerdir?',['Fasıl 113']],['Yabancı firari iadesi nasıl yapılır?',['Fasıl 290']],
];
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8811/kira_asistani.html'); await p.waitForTimeout(800);
let ok=0, isabet3=0, ilk=0; const mod=process.argv[2]||'eski';
for(const [q,exp] of SET){
  const laws=await p.evaluate(async([q,mod])=>{ const A=window.__arama; let list;
    if(mod==='yeni' && A.birlesik) list=await A.birlesik(q); else { list=A.search(q); list.push(...await A.searchTum(q,3)); }
    return list.map(a=>A.LAWBY[a.law].no+' | '+A.LAWBY[a.law].kisa+' m.'+a.no+' '+a.title.slice(0,40)); },[q,mod]);
  const iyi=l=>exp.some(e=>l.split(' | ')[0].replace(/\s+/g,' ')===e);
  const hit=laws.some(iyi); if(hit) ok++; isabet3+=laws.slice(0,3).filter(iyi).length/3; if(laws[0]&&iyi(laws[0])) ilk++;
  console.log((hit?'✓ ':'✗ ')+q+'\n     '+laws.slice(0,8).join('\n     '));
}
console.log('\nSONUÇ: bulundu '+ok+'/'+SET.length+' · ilk sırada doğru yasa '+ilk+' · ilk 3 isabet %'+Math.round(100*isabet3/SET.length),'errs',errs); await b.close();})();
