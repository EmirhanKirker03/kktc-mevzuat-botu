// arama değerlendirmesi: beklenen yasa ilk 8 kaynakta mı?
const {chromium}=require('playwright');
const SET=[
['Anayasaya göre konut dokunulmazlığı nasıl korunur?',['Anayasa']],['Temel hak ve özgürlükler hangi nedenlerle sınırlanabilir?',['Anayasa']],
['Basın özgürlüğü anayasada nasıl düzenlenmiştir?',['Anayasa']],['Mülkiyet hakkı kamulaştırma ile sınırlanabilir mi?',['Anayasa','51/1978']],
['Acentelik sözleşmesinin şekli nedir?',['47/1993']],['Özel hastane açmak için hangi koşullar gerekir?',['32/1998']],
['Teknoloji geliştirme bölgesinde vergi muafiyeti var mı?',['2/2005']],['Uluslararası bankacılık birimi nasıl lisans alır?',['41/2008']],
['Yabancılar taşınmaz mal satın alırken hangi izin gerekir, lisanslı ara yatırımcı nedir?',['YGK 07/10/2026','52/2008']],
['Dağıtılmayan kurum kazançlarına uygulanacak vergi kesintisi nedir?',['YGK 07/10/2026','YGK 16/04/2026','YGK 03/08/2026']],
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
