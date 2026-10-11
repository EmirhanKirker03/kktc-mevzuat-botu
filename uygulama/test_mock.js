// Yerel test için sahte Claude API: istemin türüne göre (cevap, derin plan, taslak, sözleşme) geçerli bir JSON döndürür.
// Kaynak kimlikleri istemdeki "### KIMLIK —" satırlarından alınır; alıntılar istemdeki metinden kopyalanır.
require('http').createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ const j=JSON.parse(b); const p=j.messages[0].content;
  if(process.env.MOCK_KAYIT){ require('fs').writeFileSync(process.env.MOCK_KAYIT+'/istem-'+Date.now()+'.txt', p); }
  const ids=[...p.matchAll(/^### ([A-Z]+[A-Za-z0-9-]*) —/gm)].map(m=>m[1]);
  const etk=(p.split('KULLANICININ BİLGİLERİ:')[1]||'').match(/\[(KİŞİ|EK|ŞİRKET)-\d+\]/); const tag=etk?etk[0]:'[KİŞİ-1]';
  let out;
  const mod=(()=>{ try{ return require('fs').readFileSync(process.env.MOCK_MOD_DOSYA||'/nonexistent','utf8').trim(); }catch(_){ return ''; } })();
  const yaz=(t,kod)=>{ res.statusCode=kod||200; res.setHeader('content-type','application/json'); res.end(JSON.stringify(kod&&kod>=400?{error:{type:'api_error',message:t}}:{content:[{type:'text',text:t}]})); };
  if(mod==='metin') return yaz('Üzgünüm, bu soruya JSON ile cevap veremiyorum.');
  if(mod==='html') return yaz(JSON.stringify({found:true,summary:'<img src=x onerror="window.__xss=1">Özet',points:[{text:'<script>window.__xss=2</script>Tespit',cites:ids[0]},{text:'Kaynaksız tespit',cites:[]},{text:'Uydurma kaynak',cites:['YOK-99']}],limits:'<b>kalın</b>',cases:[{id:'K1',finding:'x',quote:'uydurma alıntı burada yazıyor ama kararda yok'}],baslik:'<img src=x onerror="window.__xss=3">',bolumler:[{baslik:'<i>b</i>',paragraflar:[{metin:'<img src=x onerror="window.__xss=4">p',cites:ids[0]}]}],riskler:[{baslik:'<img src=x onerror="window.__xss=5">',aciklama:'a',quote:'q q q q q q',page:'<b>1</b>',cites:ids[0],derece:'<x>'}],eksikler:'metin'}));
  if(mod==='eksik') return yaz('{}');
  if(mod==='uzun') return yaz(JSON.stringify({found:true,summary:'Ö'.repeat(20000),points:Array.from({length:200},(_,i)=>({text:'Tespit '+i,cites:[ids[0]]})),limits:'',cases:[]}));
  if(mod==='hata') return yaz('aşırı yük', 529);
  if(mod==='bos') return yaz('');
  if(p.includes('{"alt":')) out={alt:['istinaf süresi','ara emri istinaf']};
  else if(p.includes('{"tur":"...","ara":')) out={tur:'kira sözleşmesi',ara:['kira artışı','tahliye']};
  else if(p.includes('"bolumler"')) out={baslik:'TALEP TAKRİRİ',bolumler:[{baslik:'',paragraflar:[{metin:'1. Davacı '+tag+' Girne\'de mukimdir.',cites:[]},{metin:'2. Talep, Yasanın ilgili maddesine dayanır.',cites:[ids[0]]},{metin:'3. Yasanın 9999. maddesi uyarınca tazminat istenir.',cites:[]}]}],doldurulacak:['Davalının adresi'],uyarilar:'Tutarları kontrol edin.'};
  else if(p.includes('"riskler"')){ const s=p.split('SÖZLEŞME:\n')[1]||''; const ilk=(s.split('\n')[1]||'').split(' ').slice(0,10).join(' ');
    out={tur:'kira sözleşmesi',ozet:'Kısa özet.',riskler:[{baslik:'Belirsiz hüküm',aciklama:'Açıklama.',quote:ilk,page:1,cites:[ids[0]],derece:'yüksek',oneri:'Değiştirin.'},{baslik:'Uydurma alıntı',aciklama:'x',quote:'bu cümle sözleşmede hiç geçmeyen uydurma bir cümledir',page:1,cites:[],derece:'düşük',oneri:''}],eksikler:[{text:'Eksik hüküm.',cites:[ids[1]||ids[0]]},{text:'Kaynaksız eksik.',cites:['YOK-1']}],limits:''}; }
  else { const derin=p.includes('DERİN ARAŞTIRMA'); out={found:true,summary:'Test cevabı.'+(p.includes('ÖNCEKİ KONUŞMA')?' (takip)':''),points:[{text:'Birinci tespit.',cites:[ids[0]],section:derin?'Genel kural':undefined},{text:'İkinci tespit.',cites:[ids[1]||ids[0]],section:derin?'Usul ve süreler':undefined}],limits:'',cases:[]}; }
  res.setHeader('content-type','application/json'); res.end(JSON.stringify({content:[{type:'text',text:'```json\n'+JSON.stringify(out)+'\n```'}]})); }); }).listen(8899);
