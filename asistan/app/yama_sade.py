# Arayüz sadeleştirme: daha az menü, daha az düğme, teknik ayrıntılar istenince görünür. İşlevler ve kimlikler (id) korunur.
import sys
p='/home/claude/kira_ai/app/template.html'; s=open(p).read()
if 'class="diger"' in s: sys.exit('zaten uygulanmış')
def r(old,new,n=1):
    global s
    assert s.count(old)==n,(s.count(old),old[:90]); s=s.replace(old,new)
def bolum(bas, son):
    i=s.index(bas); j=s.index(son,i)+len(son); return s[i:j]

IKON={
 'ask':'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1v.5M12 16.5h.01"/>',
 'taslak':'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 'file':'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
 'sure':'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M12 14v3l2 1"/>',
 'browse':'<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h6M8 11h6"/>',
 'kar':'<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>',
 'rv':'<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
 'laws':'<path d="M4 6h16M4 12h16M4 18h10"/>',
 'cat':'<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 12l9 4 9-4M3 17l9 4 9-4"/>',
}
def btn(k, uzun, kisa=None, sec=False, sel=False):
    ad = f'<span class="uzun">{uzun}</span><span class="kisa">{kisa}</span>' if kisa else uzun
    return f'<button role="tab" id="tab-{k}" data-pane="pane-{k}" aria-selected="{"true" if sel else "false"}"{" class=\"sec\"" if sec else ""}><svg viewBox="0 0 24 24">{IKON[k]}</svg>{ad}</button>'
eski_nav = bolum('<nav class="nav" role="tablist" aria-label="Bölümler">', '</nav>')
more = bolum('<button class="morebtn" id="morebtn"', '</button>')
yeni_nav = ('<nav class="nav" role="tablist" aria-label="Bölümler">\n      ' + '\n      '.join([
    btn('ask','Sor',sel=True), btn('taslak','Belge hazırla','Taslak'), btn('file','Belge incele','İncele'), btn('sure','Süre hesapla','Süre'),
    btn('browse','Mevzuat',sec=True), btn('kar','Kararlar',sec=True),
    '<details class="diger sec"><summary>Diğer</summary>' + btn('rv','Avukat incelemesi',sec=True) + btn('laws','Kaynak listesi',sec=True) + btn('cat','Meclis kataloğu',sec=True) + '</details>',
    more]) + '\n    </nav>')
s = s.replace(eski_nav, yeni_nav)
r('''<div class="stat">__TUMYASA__ yasa · __TUMTUZUK__ tüzük<br>__YASA__ yasa elle doğrulandı (__MADDE__ madde)<br>__KARAR__ Yüksek Mahkeme kararı<br>76 HMUT formu · 10 usul süresi<br>güncellik: Ekim 2026</div>
      <div class="proto">Prototip, hukuki tavsiye değildir. Son kontrol avukattadır.</div>''',
  '''<div class="stat2">__TUMYASA__ yasa · __TUMTUZUK__ tüzük · __KARAR__ karar<br>Güncel: Ekim 2026</div>
      <div class="proto">Hukuki tavsiye değildir; son kontrol avukattadır.</div>''')
r('''  <div class="menu" id="menu" hidden>
    <button data-go="pane-taslak">Belge taslağı</button>
    <button data-go="pane-sure">Süre hesapla</button>
    <button data-go="pane-rv">Avukat incelemesi</button>''','''  <div class="menu" id="menu" hidden>
    <button data-go="pane-browse">Mevzuat</button>
    <button data-go="pane-kar">Kararlar</button>
    <button data-go="pane-rv">Avukat incelemesi</button>''')
r("""$('#morebtn').setAttribute('aria-selected', ['pane-rv','pane-laws','pane-cat','pane-taslak','pane-sure'].includes(pane));""",
  """$('#morebtn').setAttribute('aria-selected', ['pane-rv','pane-laws','pane-cat','pane-browse','pane-ym','pane-kar'].includes(pane));
  if(['pane-rv','pane-laws','pane-cat'].includes(pane)){ const d=document.querySelector('nav details.diger'); if(d) d.open=true; }""")

# soru kutusu: anahtarlar yerine iki düğme; geçmiş küçük bağlantı
eski_bar = bolum('<div class="row" style="gap:14px"><label class="switch"><input type="checkbox" id="tumon" checked>', '</label></div>')
r(eski_bar, '<div class="row" style="gap:6px"><input type="checkbox" id="tumon" checked hidden><input type="checkbox" id="derin" hidden><button class="linkbtn" id="gbtn" type="button" aria-expanded="false" aria-controls="gecmis">Geçmiş <span class="muted small" id="gsay"></span></button></div>')
r('''          <button class="btn ghost" id="gbtn" type="button" aria-expanded="false" aria-controls="gecmis">Geçmiş <span class="muted small" id="gsay"></span></button>
          <button class="btn" id="ask">Ara ve cevapla</button>''','''          <button class="btn ghost" id="derinbtn" type="button" title="Soru alt sorulara bölünür, her biri ayrı aranır; daha kapsamlı ama daha yavaş">Ayrıntılı araştır</button>
          <button class="btn" id="ask">Cevapla</button>''')
r('''<div class="devam" id="devam" hidden><span>Takip sorusu sorabilirsiniz; önceki cevap bağlam olarak kullanılır, yeni cevap yine yalnızca bulunan maddelere dayanır.</span>''',
  '''<div class="devam" id="devam" hidden><span>Aynı konuda devam sorusu sorabilirsiniz.</span>''')
r('''<div class="examples"><span class="lab">Örnek sorular</span>''','''<div class="giris"><h2>KKTC yasaları ve Yüksek Mahkeme kararları hakkında sorun</h2><p>Cevaplar yalnızca resmî metinlere dayanır ve her cümlenin kaynağı gösterilir.</p></div>
    <div class="examples"><span class="lab">Örnek sorular</span>''')

# açılışta hazır cevap/kaynak gösterilmez
r("$('#q').value = EX[0]; { const l0=search(EX[0]); showSources(l0.filter(a=>l0.length&&a.law===l0[0].law)); }", "/* açılış: boş soru kutusu, örnek sorular */")
r("""$('#answer').innerHTML = '<div class="answer"><h2>Örnek: ilgili maddeler bulundu</h2><p>“Ara ve cevapla”ya basınca yapay zekâ yalnızca dayanılan maddeleri okuyarak kaynaklı bir cevap yazar ve her cümleyi kontrol eder.</p></div>';""", "")

# derin araştırma düğmesi
r("$('#ask').addEventListener('click',run);", "$('#ask').addEventListener('click',run);\n$('#derinbtn').addEventListener('click',()=>{ $('#derin').checked=true; run(); $('#derin').checked=false; });")

# kontrol sonucu: sorun yoksa tek satır
r("""h+='<div class="check ok"><b>Uydurma yok.</b><span>Yasada karşılığı olmayan bir kural yazılmadı; incelenen maddeler “Dayanılan maddeler” bölümünde.</span></div>';""",
  """h+='<div class="check ok mini" title="Yasada karşılığı olmayan bir kural yazılmadı."><b>✓ Uydurma kural yazılmadı</b></div>';""")
r("""h+='<div class="check ok"><b>Kaynak kontrolü geçti.</b><span>'+v.kept.length+' tespitin hepsi dayanılan maddelere bağlı; var olmayan madde numarası yok; cevaptaki sayılar dayanılan metinlerde geçiyor.</span></div>';""",
  """h+='<div class="check ok mini" title="'+v.kept.length+' tespitin hepsi dayanılan maddelere bağlı; var olmayan madde numarası yok; cevaptaki sayılar dayanılan metinlerde geçiyor."><b>✓ Tüm cümleler kaynaklarla kontrol edildi</b></div>';""")

# avukat geri bildirimi: tek bağlantının arkasında
r("""    '<span class="lbl">Avukat</span>'+""", """    '<button class="rvac linkbtn" type="button">Geri bildir</button><span class="lbl">Bu bilgi:</span>'+""")
r("// kaynak kartları kapalı gelir; başlığa veya düğmeye dokununca açılır",
  "document.addEventListener('click',e=>{ const b=e.target.closest('.rvac'); if(b) b.closest('.rv').classList.toggle('acik'); });\n// kaynak kartları kapalı gelir; başlığa veya düğmeye dokununca açılır")

# kaynak kartı rozetleri: yalnızca avukatın bilmesi gereken durumlar
r("""  if(LAWBY[a.law]&&LAWBY[a.law].otomatik) return '<span class="badge chg">'+(LAWBY[a.law].tuzuk?'tüzük · ':'')+(LAWBY[a.law].en?'İngilizce · ':'')+(LAWBY[a.law].ocr?'yazı tanıma · ':'')+'otomatik metin</span>';""",
  """  if(LAWBY[a.law]&&LAWBY[a.law].otomatik){ const L=LAWBY[a.law]; const n=[L.ocr?'taranmış metin':'',L.en?'İngilizce':'',L.gy&&L.gy.length?'değişiklik işlenmemiş':''].filter(Boolean); return n.length?'<span class="badge chg">'+n.join(' · ')+'</span>':''; }""")
r("""  return '<span class="badge live">'+(a.law==='KIRA'?'Değişiklik yok':'Değişiklik notu yok')+'</span>';""", "  return '';")

CSS = r'''
/* sadeleştirme */
.kisa{display:none}
@media (max-width:820px){ .uzun{display:none} .kisa{display:inline} }
nav.nav details.diger summary{list-style:none;cursor:pointer;color:var(--side-muted);font-size:12px;letter-spacing:.06em;text-transform:uppercase;padding:14px 10px 6px}
nav.nav details.diger summary::-webkit-details-marker{display:none}
nav.nav details.diger summary::after{content:" ▾"}
nav.nav details.diger[open] summary::after{content:" ▴"}
.stat2{font-size:12.5px;color:var(--side-muted);line-height:1.6}
.giris h2{font-family:var(--f-display);font-weight:650;font-size:clamp(20px,2.4vw,26px);margin:22px 0 4px;text-wrap:balance}
.giris p{margin:0 0 4px;color:var(--muted);max-width:65ch}
#pane-ask.sorulmus .giris{display:none}
#pane-ask:not(.sorulmus) .results,#pane-ask:not(.sorulmus) > footer{display:none}
.check.mini{padding:5px 10px;font-size:12.5px;display:inline-flex}
.rv .lbl,.rv .rvb{display:none!important}
.rv.acik .lbl{display:inline!important} .rv.acik .rvb{display:inline-flex!important}
.rv{border-top:0;padding-top:0}
article.sheet:not(.open) > .src{display:none}
.askbar{align-items:center}
'''
r('</style>', CSS + '</style>')
open(p,'w').write(s); print('tamam')
