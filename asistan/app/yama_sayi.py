# Sayı denetimi: cevaptaki sayılar (süre, tutar, oran) dayanılan metinde geçiyor mu?
import sys
p='/home/claude/kira_ai/app/template.html'; s=open(p).read()
if 'function sayilarIn' in s: sys.exit('zaten uygulanmış')
def r(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:90]); s=s.replace(old,new)
r("function verify(res, list){", r"""// sayı denetimi: tespitte geçen sayı (rakam veya yazıyla) dayanılan metinde geçmiyorsa işaretlenir
const SAYIK={iki:2,'üç':3,'dört':4,'beş':5,'altı':6,yedi:7,sekiz:8,dokuz:9,on:10,yirmi:20,otuz:30,'kırk':40,elli:50,'altmış':60,'yetmiş':70,seksen:80,doksan:90,'yüz':100,bin:1000,bir:1};
function sayilarIn(metin, atif){
  let t=String(metin||'').toLocaleLowerCase('tr');
  if(atif) t=t.replace(/\d+\s*\/\s*\d{2,4}/g,' ').replace(/(?:madde|m\.|emir|e\.|nizam|n\.|fasıl|form|tüzük)\s*\d+[a-zçğıöşü]?(?:\s*\(\s*[\dA-Za-z]+\s*\))*/g,' ').replace(/\d+\s*['’]?\s*(?:\.|inci|ıncı|üncü|uncu|nci|ncı)?\s*(?:madde|emir|nizam|fıkra|bent)\w*/g,' ').replace(/\(\s*\d+\s*\)/g,' ').replace(/\b(?:19|20)\d{2}\b/g,' ');
  const out=new Set();
  for(const m of t.matchAll(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g)){ const v=m[0].replace(/\.(?=\d{3})/g,''); out.add(v.replace(/^0+(?=\d)/,'')); }
  let acc=0, cur=0, var_=false;
  const bitir=()=>{ if(var_) out.add(String(acc+cur)); acc=0; cur=0; var_=false; };
  t.split(/[^a-zçğıöşüâîû]+/).forEach(w=>{ const v=SAYIK[w]; if(v===undefined){ bitir(); return; } var_=true; if(v===100) cur=(cur||1)*100; else if(v===1000){ acc+=(cur||1)*1000; cur=0; } else cur+=v; });
  bitir(); out.delete('1'); out.delete('0'); return out;
}
const KAYNAKSAYI=new Map();
function kaynakSayilari(c){ if(!KAYNAKSAYI.has(c)){ const a=BYCID[c]; const L=a&&LAWBY[a.law]; KAYNAKSAYI.set(c, a?sayilarIn([a.title,a.text,...(a.amendments||[]).map(m=>(m.change||'')+' '+(m.new_text||'')),L?L.no+' '+L.ad:''].join(' '),false):new Set()); } return KAYNAKSAYI.get(c); }
function eksikSayilar(metin, cites){ const ks=new Set(); cites.forEach(c=>kaynakSayilari(c).forEach(n=>ks.add(n))); return [...sayilarIn(metin,true)].filter(n=>!ks.has(n)); }
window.__sayi={sayilarIn, eksikSayilar}; // otomatik testler için
function verify(res, list){""")
r("""  return {kept, dropped, unknown, repealed};
}""","""  kept.forEach(k=>{ k.sayiEksik=eksikSayilar(k.text, k.cites); });
  const ozetEksik=eksikSayilar(res.summary||'', list.map(a=>a.cid));
  return {kept, dropped, unknown, repealed, ozetEksik};
}""")
r("""  const cite = c=>'<button class="cite" data-no="'+esc(c)+'">'+esc(etiket(c))+'</button>';
  let h='<div class="answer">';""","""  const cite = c=>'<button class="cite" data-no="'+esc(c)+'">'+esc(etiket(c))+'</button>';
  const sb = k=>k.sayiEksik&&k.sayiEksik.length?' <span class="badge gone" title="Bu sayı dayanılan maddenin metninde geçmiyor">sayı kaynakta yok: '+esc(k.sayiEksik.join(', '))+'</span>':'';
  let h='<div class="answer">';""")
r("""    h+='<h2>Cevap</h2><p>'+esc(res.summary||'')+'</p>';""","""    h+='<h2>Cevap</h2><p>'+esc(String(res.summary||'').slice(0,1500))+(v.ozetEksik.length?' <span class="badge gone">sayı kaynakta yok: '+esc(v.ozetEksik.join(', '))+'</span>':'')+'</p>';""")
r("""grp[s].map(k=>'<li>'+esc(k.text)+k.cites.map(cite).join('')+'</li>')""","""grp[s].map(k=>'<li>'+esc(k.text)+k.cites.map(cite).join('')+sb(k)+'</li>')""")
r("""    else h+='<ul class="points">'+v.kept.map(k=>'<li>'+esc(k.text)+k.cites.map(cite).join('')+'</li>').join('')+'</ul>';""","""    else h+='<ul class="points">'+v.kept.map(k=>'<li>'+esc(k.text)+k.cites.map(cite).join('')+sb(k)+'</li>').join('')+'</ul>';""")
r("""  const problems = v.dropped.length+v.unknown.length+v.repealed.length;""","""  const sayiSorun = notFoundOn(res,v) ? 0 : v.kept.filter(k=>k.sayiEksik.length).length + (v.ozetEksik.length?1:0);
  const problems = v.dropped.length+v.unknown.length+v.repealed.length+sayiSorun;""")
r("""    if(v.repealed.length) h+='<div class="check warn"><b>Kaldırılmış madde anıldı:""","""    if(sayiSorun) h+='<div class="check bad"><b>'+sayiSorun+' cümlede dayanılan metinde geçmeyen sayı var.</b><span>Süre, tutar veya oran yanlış olabilir; işaretli sayıları resmî metinden kontrol edin.</span></div>';
    if(v.repealed.length) h+='<div class="check warn"><b>Kaldırılmış madde anıldı:""")
r("""' tespitin hepsi dayanılan maddelere bağlı; metinde var olmayan madde numarası yok.</span></div>';""","""' tespitin hepsi dayanılan maddelere bağlı; var olmayan madde numarası yok; cevaptaki sayılar dayanılan metinlerde geçiyor.</span></div>';""")
r("function renderAnswer(q, res, v, vc){", "const notFoundOn=(res,v)=>res.found===false || !v.kept.length;\nfunction renderAnswer(q, res, v, vc){")
# dışa aktarımlarda uyarı
r("""sat.push('- '+k.text+' ['+k.cites.map(etiket).join('; ')+']'); });""","""sat.push('- '+k.text+' ['+k.cites.map(etiket).join('; ')+']'+(k.sayiEksik&&k.sayiEksik.length?' [DİKKAT: '+k.sayiEksik.join(', ')+' dayanılan metinde geçmiyor]':'')); });""")
r("""B.push({tur:'p',metin:'• '+k.text+' ['+k.cites.map(etiket).join('; ')+']'}); });""","""B.push({tur:'p',metin:'• '+k.text+' ['+k.cites.map(etiket).join('; ')+']'+(k.sayiEksik&&k.sayiEksik.length?' [DİKKAT: '+k.sayiEksik.join(', ')+' dayanılan metinde geçmiyor]':'')}); });""")
open(p,'w').write(s); print('tamam')
