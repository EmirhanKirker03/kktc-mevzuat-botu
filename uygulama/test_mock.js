// Yerel test için sahte Claude API: istemdeki ilk iki kaynak kimliğiyle geçerli bir JSON cevap döndürür.
require('http').createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ const j=JSON.parse(b); const p=j.messages[0].content;
  const ids=[...p.matchAll(/^### ([A-Z]+[A-Za-z0-9-]*) —/gm)].map(m=>m[1]);
  const out={found:true,summary:'Test cevabı.',points:[{text:'Birinci tespit.',cites:[ids[0]]}],limits:'',cases:[]};
  res.setHeader('content-type','application/json'); res.end(JSON.stringify({content:[{type:'text',text:'```json\n'+JSON.stringify(out)+'\n```'}]})); }); }).listen(8899);
