"""Okunamayan kısımlar ve derleyici notları ([okunamayan kısım], [Kaynak dosyada madde numaraları ...]) metinde
soluk ve italik gösterilir; yapay zekâya bu köşeli parantezli notların derleyiciye ait olduğu söylenir."""
import sys
p = sys.argv[1] if len(sys.argv) > 1 else 'template.html'
s = open(p, encoding='utf-8').read()
def degis(eski, yeni, say=1):
    global s
    assert s.count(eski) == say, (eski[:90], s.count(eski))
    s = s.replace(eski, yeni)
if 'function metinH' not in s:
    degis(".amd .txt{", ".okn{color:var(--muted);font-style:italic;font-family:var(--f-body,inherit);font-size:.93em}\n.amd .txt{")
    degis("const mLabel=a=>", "const metinH=t=>esc(t).replace(/\\[(okunamayan kısım|Kaynak dosyada madde numaraları[^\\]]*|Bu bölümün metni kaynak dosyada[^\\]]*|Bu maddenin metni kaynak dosyadan[^\\]]*)\\]/g,'<span class=\"okn\">[$1]</span>');\nconst mLabel=a=>")
    degis("'<h3>'+esc(a.title)+'</h3><p class=\"txt\">'+esc(a.text)+'</p>'", "'<h3>'+esc(a.title)+'</h3><p class=\"txt\">'+metinH(a.text)+'</p>'")
    degis("p.textContent=KBY[p.dataset.k].metin;", "p.innerHTML=metinH(KBY[p.dataset.k].metin);")
    degis("b+='METİN ('+", "b+='METİN (köşeli parantez içindeki [okunamayan kısım] ve benzeri notlar kaynağa değil derleyiciye aittir; o kısımlar hakkında yorum yapma, resmî metne yönlendir; '+")
open(p, 'w', encoding='utf-8').write(s)
print('tamam')
