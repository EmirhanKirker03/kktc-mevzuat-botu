// Sunucu güvenlik testi (gerçek HTTP istekleri)
const U='http://localhost:3100', fs=require('fs'), MOD=__dirname+'/mock_mod.txt';
let gec=0, kal=0; const ok=(a,v)=>{ v?gec++:kal++; console.log((v?'GEÇTİ ':'KALDI ')+a); };
const istek=async(yol,{yontem='GET',govde,cerez,tip='application/json',ip}={})=>{ const h={}; if(govde!==undefined) h['content-type']=tip; if(cerez) h.cookie=cerez; if(ip) h['x-forwarded-for']=ip;
  const r=await fetch(U+yol,{method:yontem,headers:h,body:govde===undefined?undefined:(tip==='application/json'?JSON.stringify(govde):govde),redirect:'manual'}); let j=null; try{ j=await r.clone().json(); }catch(_){}
  const sc=r.headers.get('set-cookie'); return {s:r.status,j,cerez:sc?sc.split(';')[0]:null,h:r.headers}; };
const giris=async(e,s,ip)=>istek('/api/giris',{yontem:'POST',govde:{eposta:e,sifre:s},ip});
(async()=>{
  let r=await istek('/'); ok('girişsiz ana sayfa → giriş sayfasına yönlendirme', r.s===302);
  r=await istek('/tum-0.json'); ok('girişsiz veri dosyası erişilemez', r.s===302);
  r=await istek('/api/ben'); ok('girişsiz API 401', r.s===401);
  r=await istek('/'); ok('CSP başlığı var', !!r.h.get('content-security-policy')); ok('X-Frame-Options DENY', r.h.get('x-frame-options')==='DENY');
  r=await istek('/api/giris',{yontem:'POST',govde:'eposta=a&sifre=b',tip:'application/x-www-form-urlencoded'}); ok('form biçimli POST reddedilir (415)', r.s===415);
  // yönetici
  const yon=(await giris('yonetici@test.local','yonetici12345','10.0.0.1')).cerez; ok('yönetici girişi', !!yon);
  r=await istek('/api/yonetim/kullanici',{yontem:'POST',govde:{eposta:'av1@test.local',ad:'Av Bir',buro:'B1',abonelik_bitis:'2099-01-01'},cerez:yon}); const g1=r.j.gecici_sifre; ok('avukat hesabı açıldı', !!g1);
  r=await istek('/api/yonetim/kullanici',{yontem:'POST',govde:{eposta:'av2@test.local',ad:'Av İki',buro:'B2',abonelik_bitis:'2000-01-01'},cerez:yon}); const g2=r.j.gecici_sifre;
  // geçici şifre akışı
  r=await giris('av1@test.local',g1,'10.0.0.2'); ok('geçici şifreyle girişte gecici=true', r.j&&r.j.gecici===true); const a1=r.cerez;
  const a1b=(await giris('av1@test.local',g1,'10.0.0.3')).cerez; // ikinci cihaz
  r=await istek('/api/ben',{cerez:a1}); ok('/api/ben gecici bilgisi', r.j.gecici===true);
  r=await istek('/api/sifre',{yontem:'POST',govde:{eski:g1,yeni:'YeniSifre12345'},cerez:a1}); ok('şifre değişti', r.s===200); const a1yeni=r.cerez;
  r=await istek('/api/ben',{cerez:a1b}); ok('şifre değişince diğer cihazdaki oturum kapandı', r.s===401);
  r=await istek('/api/ben',{cerez:a1yeni}); ok('şifreyi değiştiren cihaz açık kaldı ve gecici=false', r.s===200 && r.j.gecici===false);
  // çerez kurcalama
  const [ad,deg]=a1yeni.split('='); const p=deg.split('.'); r=await istek('/api/ben',{cerez:ad+'='+['1',...p.slice(1)].join('.')}); ok('kurcalanmış çerez (başka kullanıcı kimliği) reddedildi', r.s===401);
  // aboneliği bitmiş avukat
  const a2=(await giris('av2@test.local',g2,'10.0.0.4')).cerez; r=await istek('/api/sor',{yontem:'POST',govde:{istem:'test istemi uzunca'},cerez:a2}); ok('aboneliği bitmiş avukat yapay zekâ kullanamaz (403)', r.s===403);
  // uzun istem ve günlük karakter bütçesi (sunucu GUNLUK_KARAKTER=200000 ile çalışıyor)
  r=await istek('/api/sor',{yontem:'POST',govde:{istem:'x'.repeat(400001)},cerez:a1yeni}); ok('400.000 karakterden uzun istem 413 prompt_too_large', r.s===413 && r.j.kod==='prompt_too_large');
  r=await istek('/api/sor',{yontem:'POST',govde:{istem:'Soru: '+'y'.repeat(90000)},cerez:a1yeni}); ok('1. uzun istem kabul', r.s===200);
  r=await istek('/api/sor',{yontem:'POST',govde:{istem:'Soru: '+'y'.repeat(90000)},cerez:a1yeni}); ok('2. uzun istem kabul', r.s===200);
  r=await istek('/api/sor',{yontem:'POST',govde:{istem:'Soru: '+'y'.repeat(90000)},cerez:a1yeni}); ok('günlük metin bütçesi aşılınca 429', r.s===429);
  // yapay zekâ hatasında hak iadesi
  let once=(await istek('/api/ben',{cerez:yon})).j.bugun_kullanim; fs.writeFileSync(MOD,'hata');
  r=await istek('/api/sor',{yontem:'POST',govde:{istem:'kısa test istemi'},cerez:yon}); fs.writeFileSync(MOD,'');
  let sonra=(await istek('/api/ben',{cerez:yon})).j.bugun_kullanim; ok('yapay zekâ hatası 502 ve hak iade edildi', r.s===502 && sonra===once);
  // inceleme kayıtları: boyut ve gizlilik
  r=await istek('/api/inceleme',{yontem:'POST',govde:{hedef:'madde:X',karar:'dogru',not:'z'.repeat(30000),soru:'z'.repeat(30000),cevap:'z'.repeat(30000),metin:'z'.repeat(30000)},cerez:a1yeni}); ok('çok büyük inceleme kaydı reddedildi', r.s===413);
  await istek('/api/inceleme',{yontem:'POST',govde:{hedef:'madde:A1',karar:'dogru',not:'av1 notu'},cerez:a1yeni});
  await istek('/api/inceleme',{yontem:'POST',govde:{hedef:'madde:A2',karar:'duzelt',not:'av2 notu'},cerez:a2});
  r=await istek('/api/inceleme',{cerez:a1yeni}); ok('avukat yalnızca kendi incelemesini görür', r.j.length===1 && r.j[0].not==='av1 notu');
  r=await istek('/api/inceleme',{cerez:yon}); ok('yönetici tüm incelemeleri görür', r.j.length===2);
  // yönetici dışı yönetim erişimi
  r=await istek('/api/yonetim/kullanicilar',{cerez:a1yeni}); ok('avukat yönetim API kullanamaz', r.s===403);
  // şifre sıfırlama ve hesap kapatma oturumları kapatır
  const kul=(await istek('/api/yonetim/kullanicilar',{cerez:yon})).j; const av1=kul.find(k=>k.eposta==='av1@test.local');
  r=await istek('/api/yonetim/guncelle',{yontem:'POST',govde:{id:av1.id,sifre_sifirla:true},cerez:yon}); r=await istek('/api/ben',{cerez:a1yeni}); ok('yönetici şifre sıfırlayınca avukatın oturumu kapandı', r.s===401);
  const a1c=(await giris('av1@test.local',(await istek('/api/yonetim/guncelle',{yontem:'POST',govde:{id:av1.id,sifre_sifirla:true},cerez:yon})).j.gecici_sifre,'10.0.0.5')).cerez;
  await istek('/api/yonetim/guncelle',{yontem:'POST',govde:{id:av1.id,aktif:false},cerez:yon}); r=await istek('/api/ben',{cerez:a1c}); ok('hesap kapatılınca oturum kapandı', r.s===401);
  // kaba kuvvet sınırları
  let son; for(let i=0;i<9;i++) son=await giris('av2@test.local','yanlis-sifre-'+i,'10.9.9.9'); ok('aynı e-postaya 9. yanlış denemede 429', son.s===429);
  for(let i=0;i<41;i++) son=await giris('av3@test.local','yanlis-'+i,'10.7.'+Math.floor(i/5)+'.'+i); ok('aynı e-postaya farklı IP\'lerden 41. denemede 429', son.s===429);
  for(let i=0;i<31;i++) son=await giris('yok'+i+'@test.local','x','10.8.8.8'); ok('aynı IP\'den 31. yanlış denemede 429 (farklı e-postalar)', son.s===429);
  // zamanlama: olmayan e-posta da bcrypt süresi kadar sürer
  let t=Date.now(); await giris('olmayan@test.local','x','10.7.7.1'); const t1=Date.now()-t; t=Date.now(); await giris('av2@test.local','x','10.7.7.2'); const t2=Date.now()-t;
  ok('olmayan e-posta ile var olan arasında belirgin süre farkı yok ('+t1+' / '+t2+' ms)', Math.abs(t1-t2) < Math.max(60, 0.5*t2));
  console.log('\nSONUÇ: '+gec+' geçti, '+kal+' kaldı');
})().catch(e=>{ console.error('HATA',e); process.exit(1); });
