"""Meclis arşivinden alınan (Yüksek Mahkeme sisteminde dosyası olmayan) metinler ve yasa notları (nt) için arayüz/istem yaması."""
import sys
p = sys.argv[1] if len(sys.argv) > 1 else 'template.html'
s = open(p, encoding='utf-8').read()
def degis(eski, yeni, say=1):
    global s
    assert s.count(eski) == say, (eski[:80], s.count(eski))
    s = s.replace(eski, yeni)
if 'meclis:y.ks===' not in s:
    degis("gy:y.gy||[],em:y.em||[],parca:y.y==='parca',kontrol:[]};",
          "gy:y.gy||[],em:y.em||[],parca:y.y==='parca',kontrol:[],meclis:y.ks==='meclis',not:y.nt||''};")
    # madde kaynağı satırı
    degis(""": L.otomatik ? 'Kaynak: <a href="'+esc(L.url)+'" target="_blank" rel="noopener">Yüksek Mahkeme birleştirilmiş resmî metni</a> · '+""",
          """: L.otomatik ? 'Kaynak: <a href="'+esc(L.url)+'" target="_blank" rel="noopener">'+(L.meclis?'Cumhuriyet Meclisi arşivi':'Yüksek Mahkeme birleştirilmiş resmî metni')+'</a> · '+(L.meclis?'Yüksek Mahkeme sisteminde dosyası yok; Meclis\\'in yayımladığı metin (değişiklikler işlenmemiş olabilir) · ':'')+(L.not?'<b>Not: '+esc(L.not)+'</b> · ':'')+""")
    # yapay zekâya giden metin başlığı
    degis("""b+='METİN (Yüksek Mahkeme birleştirilmiş resmî metni; madde sınırları otomatik belirlendi'+""",
          """b+='METİN ('+(L.meclis?'Cumhuriyet Meclisi arşivindeki metin — Yüksek Mahkeme sisteminde dosyası yok, sonraki değişiklikler işlenmemiş olabilir':'Yüksek Mahkeme birleştirilmiş resmî metni')+'; madde sınırları otomatik belirlendi'+(L.not?'; ÖNEMLİ NOT: '+L.not:'')+""")
    # rozet
    degis("""const n=[L.ocr?'taranmış metin':'',L.en?'İngilizce':'',L.gy&&L.gy.length?'değişiklik işlenmemiş':''].filter(Boolean);""",
          """const n=[L.meclis?'Meclis metni':'',L.not?'dikkat: not var':'',L.ocr?'taranmış metin':'',L.en?'İngilizce':'',L.gy&&L.gy.length?'değişiklik işlenmemiş':''].filter(Boolean);""")
if "L.meclis?'Cumhuriyet Meclisi arşivindeki metin (" not in s:
    degis("' madde · '+(L.kira?'esas metin ve değişiklik yasaları ayrı gösterilir':L.ayri?",
          "' madde · '+(L.kira?'esas metin ve değişiklik yasaları ayrı gösterilir':L.meclis?'Cumhuriyet Meclisi arşivindeki metin (Yüksek Mahkeme sisteminde dosyası yok; sonraki değişiklikler işlenmemiş olabilir)':L.ayri?")
if '(y.kd||y.ry?.4:1)' not in s:
    degis('(y.kd?.4:1)', '(y.kd||y.ry?.4:1)')  # halkoylamasında reddedilmiş, yürürlüğe girmemiş metinler aramada geriye
if "y.yg?.9:1" not in s:
    degis('(y.kd||y.ry?.4:1)', '(y.kd||y.ry?.4:1)*(y.yg?.9:1)')  # kararnameler yasalardan biraz geride
    degis("toplam '+T.ys.filter(y=>!y.tz).length+' yasa, '+T.ys.filter(y=>y.tz).length+' tüzük · '+T.ys.filter(y=>y.o).length+' tanesi yazı tanıma ile okundu · kaynak: Yüksek Mahkeme'",
          "toplam '+T.ys.filter(y=>!y.tz&&!y.yg).length+' yasa (Anayasa dahil), '+T.ys.filter(y=>y.tz).length+' tüzük, '+T.ys.filter(y=>y.yg).length+' yasa gücünde kararname · '+T.ys.filter(y=>y.o).length+' tanesi yazı tanıma ile okundu · kaynak: Yüksek Mahkeme ve Cumhuriyet Meclisi'")
if 'glar=' not in s:
    degis("ylar=ls0.filter(x=>!x.y.tz||tem(x)).slice(0,5), tlar=ls0.filter(x=>x.y.tz&&!tem(x)).slice(0,2).filter(x=>!ylar.length||x.s>=.6*ylar[0].s);",
          "ylar=ls0.filter(x=>(!x.y.tz||tem(x))&&!x.y.yg).slice(0,5), tlar=ls0.filter(x=>x.y.tz&&!tem(x)).slice(0,2).filter(x=>!ylar.length||x.s>=.6*ylar[0].s), glar=ls0.filter(x=>x.y.yg).slice(0,2).filter(x=>!ylar.length||x.s>=.6*ylar[0].s);")
    degis("const ls=[...ylar,...tlar].sort((a,b)=>b.s-a.s);", "const ls=[...ylar,...tlar,...glar].sort((a,b)=>b.s-a.s);")
    degis("// yasalara 5, tüzüklere en fazla 2 yer: binlerce tüzük yasaların önünü kesmesin", "// yasalara 5, tüzüklere ve yasa gücünde kararnamelere en fazla 2'şer yer: yasaların önünü kesmesinler")
if 'yg:!!y.yg' not in s:
    degis("meclis:y.ks==='meclis',not:y.nt||''};", "meclis:y.ks==='meclis',not:y.nt||'',yg:!!y.yg};")
    # kararname en üstte olsa bile yasaların ağırlık ölçeği ve 'güçlü yasa' eşiği yasalara göre hesaplanır
    degis("const top=ls[0].s;", "const top=(ylar.length?ylar[0].s:ls[0].s);")
    degis("lw:d.g.lw, s:s*(.5+d.g.lw/top)*", "lw:d.g.lw, s:s*(.5+Math.min(d.g.lw,top)/top)*")
    degis("const gucluYasa=[...new Set(res.filter(x=>x.lw>=.75*top).map(x=>x.law))].slice(0,4);",
          "const gucluYasa=[...new Set(res.filter(x=>x.lw>=.75*top&&!(LAWBY[x.law]&&LAWBY[x.law].yg)).map(x=>x.law))].slice(0,4);")
open(p, 'w', encoding='utf-8').write(s)
print('yama_meclis tamam')
