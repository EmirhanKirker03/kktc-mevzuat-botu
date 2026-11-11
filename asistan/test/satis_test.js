// Tanıtım sayfası, deneme isteği ve maliyet takibi testi (gerçek HTTP istekleri; sunucular.sh çalışıyor olmalı)
const U='http://localhost:3100';
let gec=0, kal=0; const ok=(a,v)=>{ v?gec++:kal++; console.log((v?'GEÇTİ ':'KALDI ')+a); };
const istek=async(yol,{yontem='GET',govde,cerez,tip='application/json',ip}={})=>{ const h={}; if(govde!==undefined) h['content-type']=tip; if(cerez) h.cookie=cerez; if(ip) h['x-forwarded-for']=ip;
  const r=await fetch(U+yol,{method:yontem,headers:h,body:govde===undefined?undefined:(tip==='application/json'?JSON.stringify(govde):govde),redirect:'manual'}); let j=null, t=''; try{ t=await r.text(); j=JSON.parse(t); }catch(_){}
  const sc=r.headers.get('set-cookie'); return {s:r.status,j,t,cerez:sc?sc.split(';')[0]:null,h:r.headers}; };
const giris=async(e,s,ip)=>istek('/api/giris',{yontem:'POST',govde:{eposta:e,sifre:s},ip});
(async()=>{
  const ek=Date.now().toString(36);
  let r=await istek('/'); ok('girişsiz ana adres → tanıtım sayfası', r.s===302 && r.h.get('location')==='/tanitim');
  r=await istek('/tum-0.json'); ok('girişsiz veri dosyası → giriş sayfası', r.s===302 && r.h.get('location')==='/giris');
  r=await istek('/tanitim'); ok('tanıtım sayfası açılıyor (200)', r.s===200);
  ok('tanıtımda doldurulmamış yer tutucu yok', !/\{\{[A-Z_]+\}\}/.test(r.t));
  const sayilar=[...r.t.matchAll(/<div class="sayi"><b>([\d.]+)\+<\/b>/g)].map(m=>Number(m[1].replace(/\./g,'')));
  ok('tanıtımda dört sayı veriden geliyor ('+sayilar.join(', ')+')', sayilar.length===4 && sayilar.every(n=>n>=100));
  ok('tanıtımda veri güncelliği yazıyor', /Veri güncelliği: \d{1,2} \S+ \d{4}/.test(r.t));
  ok('tanıtımda iletişim satırı ortam değişkeninden', r.t.includes('0533 000 00 00'));
  r=await istek('/giris'); ok('giriş sayfasında yer tutucu yok ve deneme bağlantısı var', !/\{\{[A-Z_]+\}\}/.test(r.t) && r.t.includes('/tanitim#deneme'));
  r=await istek('/kosullar'); ok('koşullarda deneme isteği verisi açıklanıyor', r.t.includes('Deneme isteği'));

  r=await istek('/api/deneme-istek',{yontem:'POST',govde:'ad=a&eposta=b',tip:'application/x-www-form-urlencoded',ip:'10.20.0.1'}); ok('form biçimli deneme isteği reddedilir (415)', r.s===415);
  r=await istek('/api/deneme-istek',{yontem:'POST',govde:{ad:'Av',eposta:'x@y.z'},ip:'10.20.0.1'}); ok('kısa ad reddedilir (400)', r.s===400);
  r=await istek('/api/deneme-istek',{yontem:'POST',govde:{ad:'Avukat Deneme',eposta:'gecersiz'},ip:'10.20.0.1'}); ok('geçersiz e-posta reddedilir (400)', r.s===400);
  const e1='deneme-'+ek+'@test.local';
  r=await istek('/api/deneme-istek',{yontem:'POST',govde:{ad:'<img src=x onerror=alert(1)> Ayşe',buro:'Deneme Hukuk',eposta:e1.toUpperCase(),telefon:'0533 111 22 33',mesaj:'Kira davaları için.\u0000\u0007'},ip:'10.20.0.2'}); ok('geçerli deneme isteği kabul edilir', r.s===200 && r.j.ok);
  r=await istek('/api/deneme-istek',{yontem:'POST',govde:{ad:'Ayşe Deneme',eposta:e1},ip:'10.20.0.3'}); ok('aynı e-postadan ikinci istek aynı cevabı alır', r.s===200);
  r=await istek('/api/deneme-istek',{yontem:'POST',govde:{ad:'Bot Kullanıcı',eposta:'bot-'+ek+'@test.local',web:'http://spam'},ip:'10.20.0.4'}); ok('gizli alanı dolduran bot sessizce yok sayılır', r.s===200);
  let son; for(let i=0;i<6;i++) son=await istek('/api/deneme-istek',{yontem:'POST',govde:{ad:'Seri İstek '+i,eposta:'seri'+i+'-'+ek+'@test.local'},ip:'10.20.9.9'}); ok('aynı IP\'den 6. istek 429', son.s===429);
  r=await istek('/api/yonetim/istekler'); ok('girişsiz istek listesi 401', r.s===401);

  const yon=(await giris('yonetici@test.local','yonetici12345','10.20.1.1')).cerez; ok('yönetici girişi', !!yon);
  r=await istek('/api/yonetim/istekler',{cerez:yon}); const L=r.j||[]; const benim=L.filter(i=>i.eposta===e1);
  ok('istek listede bir kez ve küçük harfli e-postayla', benim.length===1);
  ok('bot isteği kaydedilmedi', !L.some(i=>i.eposta==='bot-'+ek+'@test.local'));
  ok('denetim karakterleri temizlendi', benim[0] && !/[\u0000-\u001f]/.test(benim[0].mesaj));
  ok('hız sınırına takılan 6. istek kaydedilmedi', !L.some(i=>i.eposta==='seri5-'+ek+'@test.local'));
  r=await istek('/yonetim',{cerez:yon}); ok('yönetim sayfası ad alanını kaçışlayarak basıyor (esc)', r.t.includes('${esc(i.ad)}') && r.t.includes('Deneme istekleri'));
  r=await istek('/api/yonetim/istek',{yontem:'POST',govde:{id:benim[0].id,islem:'baska'},cerez:yon}); ok('geçersiz işlem 400', r.s===400);
  r=await istek('/api/yonetim/istek',{yontem:'POST',govde:{id:benim[0].id,islem:'ac'},cerez:yon}); const gs=r.j&&r.j.gecici_sifre;
  const beklenen=new Date(Date.now()+7*864e5).toISOString().slice(0,10);
  ok('tek tıkla deneme hesabı açılır (7 gün)', r.s===200 && !!gs && r.j.abonelik_bitis===beklenen);
  r=await istek('/api/yonetim/istek',{yontem:'POST',govde:{id:benim[0].id,islem:'ac'},cerez:yon}); ok('aynı istekten ikinci hesap açılamaz (400)', r.s===400);
  r=await giris(e1,gs,'10.20.1.2'); const av=r.cerez; ok('deneme hesabı geçici şifreyle giriş yapar', r.s===200 && r.j.gecici===true);
  r=await istek('/api/ben',{cerez:av}); ok('deneme hesabı abone sayılır', r.j && r.j.abone===true && r.j.abonelik_bitis===beklenen);
  r=await istek('/api/yonetim/istekler',{cerez:av}); ok('avukat istek listesini göremez (403)', r.s===403);
  r=await istek('/api/yonetim/istek',{yontem:'POST',govde:{id:1,islem:'sil'},cerez:av}); ok('avukat istek silemez (403)', r.s===403);

  r=await istek('/api/sor',{yontem:'POST',govde:{istem:'Kiracı hangi hâllerde tahliye edilir? '.repeat(20)},cerez:av}); ok('deneme hesabı yapay zekâyı kullanır', r.s===200 && typeof r.j.metin==='string');
  r=await istek('/api/yonetim/kullanicilar',{cerez:yon}); const ku=(r.j||[]).find(k=>k.eposta===e1);
  ok('belirteç sayıları ve maliyet kaydedildi (giriş '+(ku&&ku.giris30)+', çıkış '+(ku&&ku.cikis30)+', $'+(ku&&ku.maliyet30)+')', ku && ku.giris30>0 && ku.cikis30===200 && ku.maliyet30>0 && ku.son30===1);
  ok('son kullanım günü doluyor', ku && ku.son_kullanim===new Date().toISOString().slice(0,10));
  r=await istek('/api/yonetim/istek',{yontem:'POST',govde:{id:benim[0].id,islem:'sil'},cerez:yon}); const r2=await istek('/api/yonetim/istekler',{cerez:yon});
  ok('istek silinir', r.s===200 && !(r2.j||[]).some(i=>i.id===benim[0].id));
  console.log('\nSONUÇ: '+gec+' geçti, '+kal+' kaldı');
})().catch(e=>{ console.error('HATA',e); process.exit(1); });
