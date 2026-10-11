// Yerel test için sahte Claude API: istemin türüne göre (cevap, derin plan, taslak, sözleşme) geçerli bir JSON döndürür.
// Kaynak kimlikleri istemdeki "### KIMLIK —" satırlarından alınır; alıntılar istemdeki metinden kopyalanır.
require('http').createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ const j=JSON.parse(b); const p=j.messages[0].content;
  const ids=[...p.matchAll(/^### ([A-Z]+[A-Za-z0-9-]*) —/gm)].map(m=>m[1]);
  const etk=(p.split('KULLANICININ BİLGİLERİ:')[1]||'').match(/\[(KİŞİ|EK|ŞİRKET)-\d+\]/); const tag=etk?etk[0]:'[KİŞİ-1]';
  let out;
  if(p.includes('{"alt":')) out={alt:['istinaf süresi','ara emri istinaf']};
  else if(p.includes('{"tur":"...","ara":')) out={tur:'kira sözleşmesi',ara:['kira artışı','tahliye']};
  else if(p.includes('"bolumler"')) out={baslik:'TALEP TAKRİRİ',bolumler:[{baslik:'',paragraflar:[{metin:'1. Davacı '+tag+' Girne\'de mukimdir.',cites:[]},{metin:'2. Talep, Yasanın ilgili maddesine dayanır.',cites:[ids[0]]},{metin:'3. Yasanın 9999. maddesi uyarınca tazminat istenir.',cites:[]}]}],doldurulacak:['Davalının adresi'],uyarilar:'Tutarları kontrol edin.'};
  else if(p.includes('"riskler"')){ const s=p.split('SÖZLEŞME:\n')[1]||''; const ilk=(s.split('\n')[1]||'').split(' ').slice(0,10).join(' ');
    out={tur:'kira sözleşmesi',ozet:'Kısa özet.',riskler:[{baslik:'Belirsiz hüküm',aciklama:'Açıklama.',quote:ilk,page:1,cites:[ids[0]],derece:'yüksek',oneri:'Değiştirin.'},{baslik:'Uydurma alıntı',aciklama:'x',quote:'bu cümle sözleşmede hiç geçmeyen uydurma bir cümledir',page:1,cites:[],derece:'düşük',oneri:''}],eksikler:[{text:'Eksik hüküm.',cites:[ids[1]||ids[0]]},{text:'Kaynaksız eksik.',cites:['YOK-1']}],limits:''}; }
  else { const derin=p.includes('DERİN ARAŞTIRMA'); out={found:true,summary:'Test cevabı.'+(p.includes('ÖNCEKİ KONUŞMA')?' (takip)':''),points:[{text:'Birinci tespit.',cites:[ids[0]],section:derin?'Genel kural':undefined},{text:'İkinci tespit.',cites:[ids[1]||ids[0]],section:derin?'Usul ve süreler':undefined}],limits:'',cases:[]}; }
  res.setHeader('content-type','application/json'); res.end(JSON.stringify({content:[{type:'text',text:'```json\n'+JSON.stringify(out)+'\n```'}]})); }); }).listen(8899);
