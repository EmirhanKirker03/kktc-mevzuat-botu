// Arama değerlendirmesi (avukat pratiği, usul ağırlıklı): beklenen yasa/tüzük ilk 7 kaynakta mı, ilk sırada mı?
const {chromium}=require('/opt/npm-tools/node_modules/playwright');
const SET=[
['Hüküm aleyhine istinaf süresi nedir?',['Tüzük 453','9/1976']],['Ara emrine karşı kaç gün içinde istinafa gidilir?',['Tüzük 453','9/1976']],
['Davalı celpnameye ispatı vücut kaydı yaptırmazsa gıyabi hüküm alınabilir mi?',['Tüzük 453','Fasıl 6']],['Ara emri (ihtiyati tedbir) hangi koşullarda verilir?',['Fasıl 6','9/1976','Tüzük 453']],
['Hükmün icrası için hangi müzekkereler çıkarılabilir?',['Fasıl 6','Tüzük 453']],['Hükümlü borçlunun maaşına haciz konabilir mi?',['Fasıl 6','Tüzük 453']],
['Talep takriri ne zaman dosyalanır?',['Tüzük 453']],['Davada mahkeme masraflarını kim öder?',['Tüzük 453','Fasıl 6','9/1976']],
['Kaza Mahkemesinin yetki sınırları nelerdir?',['9/1976']],['Ağır Ceza Mahkemesi mahkumiyetine karşı istinaf süresi nedir?',['Fasıl 155']],
['Sanık kefaletle nasıl serbest bırakılır?',['Fasıl 155']],['Tahkim kararı nasıl tenfiz edilir?',['Fasıl 4']],
['Şirket nasıl tasfiye edilir?',['Fasıl 113']],['Taşınmaz satışında tapu devri nasıl yapılır?',['11/1978','Fasıl 224']],
['Taşınmaz üzerine ipotek nasıl tesis edilir?',['11/1978']],['Sözleşmenin ihlalinde tazminat nasıl hesaplanır?',['Fasıl 149']],
['Komşunun ihmali yüzünden zarar gördüm, tazminat isteyebilir miyim?',['Fasıl 148']],['Haksız fiil davası açma süresi ne kadardır?',['Fasıl 15','Fasıl 148']],
['Sözleşmeden doğan alacak ne zaman zamanaşımına uğrar?',['Fasıl 15']],['Kiracı kirayı ödemezse tahliye istenebilir mi?',['17/1981']],
['Boşanma davası hangi sebeplerle açılır?',['1/1998']],['Çocuğun velayeti boşanmada kime verilir?',['1/1998']],
['İşçi haksız yere işten çıkarılırsa hangi tazminatları alır?',['22/1992']],['Ayıplı malı satıcıya iade edebilir miyim?',['40/2003']],
['Yabancılar KKTC\'de taşınmaz edinebilir mi?',['52/2008']],['Kişisel veriler hangi durumlarda işlenebilir?',['89/2007']],
['Avukatın meslek kurallarına aykırı davranışının disiplin yaptırımı nedir?',['Fasıl 2','Tüzük 700-1981']],['Bir kişi hakkında iflas kararı nasıl verilir?',['Fasıl 5']],
['Vasiyetname geçerli olması için nasıl yapılmalı?',['Fasıl 195']],['Apartman ortak giderini ödemeyen kat malikine ne yapılır?',['35/2010']],
['Ticaret markası nasıl tescil edilir?',['Fasıl 268']],['Tüketici kredisinde erken ödeme yapılırsa faiz indirimi var mı?',['31/2020']],
['Gelir vergisi beyannamesi ne zaman verilir?',['24/1982']],['Yabancı bir işçi için çalışma izni nasıl alınır?',['63/2006']],
['Tutuklanan kişi ne kadar sürede mahkemeye çıkarılmalıdır?',['Fasıl 155']],['Davada tanık celbi için ne yapılır?',['Tüzük 453','Fasıl 6']],
['Yemin takriri nasıl hazırlanır ve kim önünde yapılır?',['Tüzük 453']],['Karşı taraftan belgelerin ibrazı nasıl istenir?',['Tüzük 453']],
['Mahkeme makul kira miktarını nasıl belirler?',['17/1981']],['Alkollü araç kullanmanın cezası nedir?',['21/1974','43/1991']],
['Kira tahliye davasına hangi mahkeme bakar?',['17/1981']],['Ölen kişinin mirası mirasçılar arasında nasıl paylaştırılır?',['Fasıl 195']],
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
