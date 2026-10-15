"""Arama: sorudaki kelimeler bir yasanın adının tamamını karşılıyorsa (ör. "kamu görevlisi" → Kamu Görevlileri Yasası;
ad en az iki anlamlı kelime) o yasa öne alınır; adı daha uzun benzer yasalar (Güvenlik Kamu Görevlileri) bundan yararlanmaz."""
import sys
p = sys.argv[1] if len(sys.argv) > 1 else 'template.html'
s = open(p, encoding='utf-8').read()
eski = "  const goruldu=new Set();\n  const ls0=T.ys.map((y,i)=>({y, s:(s1[i]+adBonus(i)+(s2?.3*s2[i]:0))*"
yeni = ("  if(!T.adk) T.adk=T.ys.map(y=>[...new Set(toks(y.a.replace(/\\(.*?\\)/g,' ')))].filter(w=>!['yasas','tuzug','kanun','karar','emirn'].includes(w)));\n"
        "  const teF=fold(terimEk(q));\n"
        "  const adTam=i=>{ const k=T.adk[i]; if(k.length>=2 && k.length<=5 && k.every(w=>own.has(w))) return 1.5; if(k.length===1 && teF && teF.includes(fold(T.ys[i].a.replace(/\\(.*?\\)/g,' ')).trim())) return 1.5; if(k.length===1 && own.has(k[0]) && (dfAd[k[0]]||99)<=5) return 1.3; return 1; };\n"
        "  const goruldu=new Set();\n  const ls0=T.ys.map((y,i)=>({y, s:(s1[i]+adBonus(i)+(s2?.3*s2[i]:0))*adTam(i)*")
if 'T.adk' not in s:
    assert s.count(eski) == 1
    s = s.replace(eski, yeni)
open(p, 'w', encoding='utf-8').write(s); print('tamam')
