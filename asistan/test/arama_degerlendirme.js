// arama değerlendirmesi: beklenen yasa ilk 8 kaynakta mı?
const {chromium}=require('playwright');
const SET=[
['Silah ruhsatı nasıl alınır?',['Fasıl 57']],['Avukat olmak için şartlar nelerdir?',['Fasıl 2']],['Belediye başkanının görevleri nelerdir?',['51/1995']],
['Bir kişi hakkında iflas kararı nasıl verilir?',['Fasıl 5']],['Uyuşturucu bağımlısının tedavisi nasıl yapılır?',['28/2016']],['Gelir vergisi kimlerden alınır?',['24/1982']],
['Kamu görevlisine hangi disiplin cezaları verilebilir?',['7/1979']],['Kişisel veriler hangi durumlarda işlenebilir?',['89/2007']],['Kredi kartı borcuna ne kadar faiz uygulanabilir?',['58/2014']],
['Hayvana kötü muamele etmenin cezası nedir?',['8/2013','Fasıl 154']],['Çevreyi kirletmenin yaptırımı nedir?',['18/2012']],['Elektronik imza ıslak imza yerine geçer mi?',['93/2007']],
['Yabancı mahkeme kararı KKTC\'de nasıl tenfiz edilir?',['Fasıl 10']],['Polisin arama yetkisi nedir?',['51/1984','Fasıl 155']],['Yabancılar KKTC\'de taşınmaz mal edinebilir mi?',['52/2008']],
['Arazi satış sözleşmesinin aynen ifası istenebilir mi?',['Fasıl 232']],['Dolandırıcılığın cezası nedir?',['Fasıl 154']],['Ev sahibi kirayı ne kadar artırabilir?',['17/1981']],
['İşçinin kıdem tazminatı nasıl hesaplanır?',['22/1992']],['Boşanmada nafaka nasıl belirlenir?',['1/1998']],['Vasiyetname nasıl yapılır?',['Fasıl 195']],
['Alkollü araç kullanmanın cezası nedir?',['21/1974','43/1991']],['Apartman aidatını ödemeyen kat malikine ne yapılır?',['35/2010']],['Tutuklu kişi kaç gün polis nezaretinde tutulabilir?',['Fasıl 155']],
['Çocuğun korunması için mahkeme hangi emirleri verebilir?',['Fasıl 352']],
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
