# template.html'e avukat araçlarını ekler (bir kez çalıştırılır; her değişiklik birebir eşleşmeyle yapılır)
import sys
P = '/home/claude/kira_ai/app/template.html'
s = open(P).read()
if 'id="pane-sure"' in s: sys.exit('zaten uygulanmış')
def r(old, new, n=1):
    global s
    c = s.count(old)
    if c != n: sys.exit(f'eşleşme {c} (beklenen {n}): {old[:80]!r}')
    s = s.replace(old, new)

CSS = r'''
/* araçlar */
select,input[type=date]{color:var(--ink);background:var(--sheet);border:1px solid var(--rule-2);border-radius:var(--r);padding:10px 12px;width:100%;max-width:640px;font:inherit}
.btn.sm{padding:6px 12px;font-size:13.5px}
.acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--rule)}
.devam{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;background:var(--seal-soft);border-radius:var(--r);padding:8px 12px;font-size:13.5px;margin-top:10px}
.linkbtn{background:none;border:0;color:var(--seal);cursor:pointer;font-weight:600;padding:2px 4px;font-size:13px}
.gecmis{background:var(--sheet);border:1px solid var(--rule);border-radius:var(--r);padding:10px 12px;margin-top:10px;max-height:340px;overflow:auto}
.grow{display:flex;justify-content:space-between;gap:12px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--rule);padding:8px 2px;cursor:pointer;color:inherit;font:inherit}
.grow span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.grow:hover span:first-child{color:var(--seal)}
.gtxt{white-space:pre-wrap;font-family:var(--f-body);font-size:14px;background:var(--paper);border-radius:6px;padding:12px;margin:8px 0 0;max-height:520px;overflow:auto}
.answer h3.bol{font-family:var(--f-display);font-weight:650;font-size:16.5px;margin:14px 0 4px;color:var(--seal)}
.sure .sonGun{font-family:var(--f-display);font-weight:650;font-size:clamp(24px,3.4vw,32px);line-height:1.15;margin:2px 0}
.adim{margin:12px 0 0;padding-left:20px;font-size:14px}
.adim li{margin:3px 0}
.quote{margin:6px 0;padding:6px 10px;border-left:3px solid var(--seal);background:var(--paper);font-size:13.5px;border-radius:0 6px 6px 0}
.dayanak{margin-top:12px;padding-top:10px;border-top:1px solid var(--rule)}
.kirmizi{color:var(--bad)} .sari{color:var(--warn)}
.trow{display:flex;gap:10px;align-items:center;padding:5px 0;border-bottom:1px solid var(--rule);font-size:13.5px}
.trow span:nth-child(2){flex:1;min-width:0}
.srow{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;background:var(--sheet);border:1px solid var(--rule);border-radius:var(--r);padding:10px 12px;font-size:14px}
.srow.gecti{opacity:.6}
.belge{background:var(--sheet);outline:none;font-family:var(--f-display);font-size:15.5px;line-height:1.6}
.belge h2{font-size:19px;text-align:center;margin:0 0 12px}
.belge h3{font-size:16px;margin:14px 0 6px}
.belge p{margin:0 0 10px;max-width:none}
.belge:focus{box-shadow:0 0 0 2px var(--seal-soft);border-radius:6px}
.belge .cite{font-family:var(--f-body)}
'''
r('@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}\n</style>',
  '@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}\n' + CSS + '</style>')

# gezinti: Araçlar grubu
r('''<div class="grp">Kaynaklar</div>''',
  '''<div class="grp">Araçlar</div>
      <button role="tab" id="tab-taslak" data-pane="pane-taslak" aria-selected="false" class="sec"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Belge taslağı</button>
      <button role="tab" id="tab-sure" data-pane="pane-sure" aria-selected="false" class="sec"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M12 14v3l2 1"/></svg>Süre hesapla</button>
      <div class="grp">Kaynaklar</div>''')
r('''<div class="menu" id="menu" hidden>
    <button data-go="pane-rv">Avukat incelemesi</button>''', '''<div class="menu" id="menu" hidden>
    <button data-go="pane-taslak">Belge taslağı</button>
    <button data-go="pane-sure">Süre hesapla</button>
    <button data-go="pane-rv">Avukat incelemesi</button>''')
r("""const NAV={ 'pane-ask':'tab-ask',""", """const NAV={ 'pane-taslak':'tab-taslak','pane-sure':'tab-sure','pane-ask':'tab-ask',""")
r("""$('#morebtn').setAttribute('aria-selected', ['pane-rv','pane-laws','pane-cat'].includes(pane));""",
  """$('#morebtn').setAttribute('aria-selected', ['pane-rv','pane-laws','pane-cat','pane-taslak','pane-sure'].includes(pane));
  if(pane==='pane-sure') sureInit();
  if(pane==='pane-taslak') taslakInit();""")

# soru bölümü: derin araştırma, geçmiş, takip sorusu
r('''<label class="switch"><input type="checkbox" id="tumon" checked> Tüm yasa ve tüzüklerde ara</label>''',
  '''<div class="row" style="gap:14px"><label class="switch"><input type="checkbox" id="tumon" checked> Tüm yasa ve tüzüklerde ara</label><label class="switch" title="Soru alt sorulara bölünür, her biri ayrı aranır; daha uzun sürer"><input type="checkbox" id="derin"> Derin araştırma</label></div>''')
r('''<button class="btn" id="ask">Ara ve cevapla</button>
        </div>
      </div>
    </div>''', '''<button class="btn ghost" id="gbtn" type="button" aria-expanded="false" aria-controls="gecmis">Geçmiş <span class="muted small" id="gsay"></span></button>
          <button class="btn" id="ask">Ara ve cevapla</button>
        </div>
      </div>
    </div>
    <div class="devam" id="devam" hidden><span>Takip sorusu sorabilirsiniz; önceki cevap bağlam olarak kullanılır, yeni cevap yine yalnızca bulunan maddelere dayanır.</span><button class="linkbtn" id="yenikonu" type="button">Yeni konu</button></div>
    <div class="gecmis" id="gecmis" hidden><div class="sec-h"><h3>Soru geçmişi</h3><button class="linkbtn" id="gsil" type="button">Geçmişi temizle</button></div><p class="small muted" style="margin:2px 0 6px">Yalnızca bu cihazdaki tarayıcıda tutulur; sunucuya gönderilmez.</p><div id="glist"></div></div>''')

# dosya bölümü: sözleşme inceleme düğmesi
r('''<button class="btn" id="summ">Özet ve kronoloji çıkar</button>''',
  '''<button class="btn" id="summ">Özet ve kronoloji çıkar</button>
          <button class="btn ghost" id="risk">Sözleşmeyi incele</button>''')
r('''<h2>Dosya özeti</h2><p>Dava dosyasını yükleyin; kişisel bilgiler önce bu cihazda gizlenir, özet ve kronolojideki her cümle belgeden birebir alıntıyla doğrulanır.</p>''',
  '''<h2>Dosya özeti ve sözleşme inceleme</h2><p>Dava dosyası veya sözleşme yükleyin; kişisel bilgiler önce bu cihazda gizlenir. Özet, kronoloji ve sözleşme risklerindeki her tespit belgeden birebir alıntıyla, mevzuat dayanakları da bulunan maddelerle kontrol edilir.</p>''')

PANES = '''
  <section id="pane-taslak" role="tabpanel" hidden>
    <div class="pane-head"><div><h2>Belge taslağı</h2><p>HMUT formlarına veya serbest belge türlerine göre ilk taslak. Olaylar yalnızca sizin yazdıklarınızdan alınır; hukuki dayanak içeren her paragraf bulunan maddelerle kontrol edilir. Taslak avukat kontrolünden geçmeden kullanılmamalıdır.</p></div></div>
    <div class="grid">
      <div class="col">
        <label class="lab" for="tturu">Belge türü</label>
        <select id="tturu"></select>
        <div id="tform"></div>
        <label class="lab" for="tmah">Mahkeme</label>
        <input type="text" id="tmah" placeholder="ör. Lefkoşa Kaza Mahkemesi">
        <label class="lab" for="ttaraf">Taraflar</label>
        <textarea id="ttaraf" style="min-height:64px" placeholder="ör. Davacı: Ayşe Demir, Girne · Davalı: Örnek Ltd."></textarea>
        <label class="lab" for="tolay">Olaylar ve talep</label>
        <textarea id="tolay" style="min-height:170px" placeholder="Olayları tarih sırasıyla, talep ettiğiniz çareleri ve tutarları yazın."></textarea>
        <label class="switch"><input type="checkbox" id="tgizle" checked> Adları ve kişisel bilgileri yapay zekâya göndermeden gizle</label>
        <div class="row"><button class="btn" id="thazirla">Taslak hazırla</button><button class="btn ghost" id="tdur" hidden>Durdur</button><span class="state" id="tstate"></span></div>
      </div>
      <div class="col">
        <div id="tcikti"><div class="answer"><h2>Nasıl çalışır</h2><p>Belge türünü seçip olayları yazın. Uygulama önce ilgili yasa ve tüzük maddelerini bulur, sonra yapay zekâ taslağı yalnızca bu maddelere ve sizin bilgilerinize dayanarak yazar. HMUT formu seçerseniz resmî kalıp korunur.</p><p>Eksik bilgiler <b>[....]</b> olarak boş bırakılır. Taslak ekranda düzenlenebilir ve Word olarak indirilebilir.</p></div></div>
        <div class="sec-h"><h3>Dayanılan maddeler</h3></div>
        <div id="tkaynak" class="col" style="gap:8px"><p class="muted small" style="margin:0">Taslak hazırlanınca bulunan maddeler burada listelenir.</p></div>
      </div>
    </div>
  </section>

  <section id="pane-sure" role="tabpanel" hidden>
    <div class="pane-head"><div><h2>Süre hesapla</h2><p>HMUT ve Ceza Muhakemeleri Usulü Yasası'ndaki usul süreleri. Hesap Yorum Yasası m.31'e göre yapılır; her kuralın dayandığı cümle resmî metinden birebir gösterilir.</p></div></div>
    <div class="grid">
      <div class="col">
        <label class="lab" for="skural">Süre</label>
        <select id="skural"></select>
        <label class="lab" for="sbas" id="sbaslab">Başlangıç tarihi</label>
        <input type="date" id="sbas">
        <details class="sheet"><summary><span class="t">Değişken tatiller (bayramlar)</span><span class="muted small" id="statsay"></span></summary>
          <p class="small muted" style="margin:8px 0">Şeker ve Kurban Bayramı ile Mevlit her yıl farklı günlere denk gelir. Resmî tarihleri buraya ekleyin; hesap bu günleri de sayılmayan gün olarak kullanır. Bilgiler yalnızca bu cihazda tutulur.</p>
          <div class="row"><input type="date" id="statyeni" style="max-width:180px"><input type="text" id="statad" placeholder="ör. Kurban Bayramı 1. gün" style="flex:1;min-width:150px"><button class="btn ghost sm" id="statekle" type="button">Ekle</button></div>
          <div id="statlist" style="margin-top:8px"></div>
        </details>
        <details class="sheet"><summary><span class="t">Hesap kuralları</span><span class="muted small">Yorum Yasası m.31</span></summary><div id="yorumbilgi" style="margin-top:8px"></div></details>
      </div>
      <div class="col">
        <div id="sonuc"></div>
        <div class="sec-h"><h3>Süre listem</h3><span class="muted small">yalnızca bu cihazda</span></div>
        <div class="row"><input type="date" id="eltarih" style="max-width:180px"><input type="text" id="elnot" placeholder="Duruşma veya başka tarih (ör. 2024/123 duruşma)" style="flex:1;min-width:160px"><button class="btn ghost sm" id="elekle" type="button">Ekle</button><span class="state small" id="eldurum"></span></div>
        <div id="slist" class="col" style="gap:8px"></div>
      </div>
    </div>
  </section>
'''
r('''  <section id="pane-browse" role="tabpanel" hidden>''', PANES + '''
  <section id="pane-browse" role="tabpanel" hidden>''')
r('''<script type="application/json" id="mevzuat">__MEVZUAT__</script>''',
  '''<script type="application/json" id="mevzuat">__MEVZUAT__</script>
<script type="application/json" id="araclar">__ARACLAR__</script>''')

# kaynak kartı: kimlik öneki
r('''function sheet(a, tag){''', '''function sheet(a, tag, idp){''')
r('''return '<'+tag+' class="sheet" id="m-'+esc(a.cid)+'">'+''', '''return '<'+tag+' class="sheet" id="'+(idp||'m-')+esc(a.cid)+'">'+''')

# istem: madde blokları ayrı fonksiyon; takip sorusu ve derin araştırma
r('''function promptFor(q, list, cases){
  const blocks = list.map(a=>{''', '''function maddeBloklari(list){
  return list.map(a=>{''')
r('''    return b;
  }).join('\\n\\n');
  const ids = list.map(a=>a.cid).join(', ');''', '''    return b;
  }).join('\\n\\n');
}
function promptFor(q, list, cases, ek){
  ek=ek||{}; const blocks=maddeBloklari(list);
  const ids = list.map(a=>a.cid).join(', ');''')
r('''8. "OTOMATİK" ya da yazı tanıma ile okunmuş metinlere dayanan tespitlerde bunu "limits" içinde belirt ve avukatın resmî metni kontrol etmesini iste. Parça kimliklerini madde numarası gibi anma.

SORU: ${q}''', '''8. "OTOMATİK" ya da yazı tanıma ile okunmuş metinlere dayanan tespitlerde bunu "limits" içinde belirt ve avukatın resmî metni kontrol etmesini iste. Parça kimliklerini madde numarası gibi anma.${ek.derin?`
9. Bu bir DERİN ARAŞTIRMADIR. Cevabı alt başlıklara ayır ve her point'e "section" alanında alt başlığın adını yaz (ör. "Genel kural", "İstisnalar", "Usul ve süreler", "Yüksek Mahkeme içtihadı"). 6-14 tespit yaz; her biri kaynaklı olsun.`:''}${ek.onceki||''}

SORU: ${q}''')
r('''{"found": true, "summary": "1-2 cümlelik doğrudan cevap", "points": [{"text": "tek bir tespit", "cites": ["KIRA-6"]}],''',
  '''{"found": true, "summary": "1-2 cümlelik doğrudan cevap", "points": [{"text": "tek bir tespit", "cites": ["KIRA-6"]${ek.derin?', "section": "alt başlık"':''}}],''')
r('''if(cites.length && p.text) kept.push({text:String(p.text), cites});''', '''if(cites.length && p.text) kept.push({text:String(p.text), cites, section:p.section?String(p.section):''});''')
r('''h+='<h2>Cevap</h2><p>'+esc(res.summary||'')+'</p><ul class="points">'+v.kept.map(k=>'<li>'+esc(k.text)+k.cites.map(cite).join('')+'</li>').join('')+'</ul>';''',
  '''h+='<h2>Cevap</h2><p>'+esc(res.summary||'')+'</p>';
    if(v.kept.some(k=>k.section)){ const sira=[], grp={}; v.kept.forEach(k=>{ const s=k.section||'Diğer'; if(!grp[s]){ grp[s]=[]; sira.push(s); } grp[s].push(k); });
      h+=sira.map(s=>'<h3 class="bol">'+esc(s)+'</h3><ul class="points">'+grp[s].map(k=>'<li>'+esc(k.text)+k.cites.map(cite).join('')+'</li>').join('')+'</ul>').join(''); }
    else h+='<ul class="points">'+v.kept.map(k=>'<li>'+esc(k.text)+k.cites.map(cite).join('')+'</li>').join('')+'</ul>';''')

# akış: takip sorusu, derin araştırma, cevap eylemleri
r('''  const q=$('#q').value.trim(); if(!q) return;
  $('#pane-ask').classList.add('sorulmus');
  let list;
  if($('#tumon').checked){ $('#state').textContent='Tüm yasalarda aranıyor…'; try{ list=await birlesik(q,7); }catch(e){ list=search(q); } $('#state').textContent=''; }
  else list=search(q);
  showSources(list);
  const alanlar=[...new Set(list.map(a=>LAW2ALAN[a.law]).filter(Boolean))];
  let cases=[]; $('#cases').innerHTML='<p class="muted small" style="margin:0">Kararlar yükleniyor…</p>';
  try{ cases=await searchCases(q, list, 3, 'all', alanlar); showCases(cases, alanlar); }''',
  '''  const q=$('#q').value.trim(); if(!q) return;
  $('#pane-ask').classList.add('sorulmus'); $('#gecmis').hidden=true;
  const onc=SOHBET.length?SOHBET[SOHBET.length-1]:null;
  const aq=onc?onc.q+' '+q:q;
  const onceki=SOHBET.length?'\\n\\nÖNCEKİ KONUŞMA (bu soru bir takip sorusudur; bağlam için kullan, ama yalnızca aşağıdaki metinlere dayan):\\n'+SOHBET.map(x=>'Soru: '+x.q+'\\nVerilen cevap: '+x.ozet).join('\\n---\\n'):'';
  const derin=$('#derin').checked && !!sampleFn;
  let list, alt=[];
  if(derin){
    ctl=new AbortController(); $('#ask').disabled=true; $('#stop').hidden=false; $('#answer').innerHTML='';
    try{ alt=await derinPlan(q, onceki, ctl.signal); }catch(e){ $('#state').textContent=hataMesaj(e); $('#ask').disabled=false; $('#stop').hidden=true; return; }
    list=await cokluAra([aq,...alt], 16, s=>$('#state').textContent=s);
    $('#ask').disabled=false; $('#stop').hidden=true;
  }
  else if($('#tumon').checked){ $('#state').textContent='Tüm yasalarda aranıyor…'; try{ list=await birlesik(aq,7); }catch(e){ list=search(aq); } $('#state').textContent=''; }
  else list=search(aq);
  showSources(list);
  const alanlar=[...new Set(list.map(a=>LAW2ALAN[a.law]).filter(Boolean))];
  let cases=[]; $('#cases').innerHTML='<p class="muted small" style="margin:0">Kararlar yükleniyor…</p>';
  try{ cases=await searchCases(derin?aq+' '+alt.join(' '):aq, list, derin?5:3, 'all', alanlar); showCases(cases, alanlar); }''')
r('''    const res = await sampleFn.json(promptFor(q,list,cases),{signal:ctl.signal, modelTier:'default'});
    renderAnswer(q, res||{}, verify(res||{}, list), verifyCases(res||{}, cases)); $('#state').textContent='';''',
  '''    const res = await sampleFn.json(promptFor(q,list,cases,{onceki, derin}),{signal:ctl.signal, modelTier:derin?'complex':'default'});
    const v=verify(res||{}, list), vc=verifyCases(res||{}, cases);
    renderAnswer(q, res||{}, v, vc); cevapEylem(q, res||{}, v, vc, list); $('#state').textContent='';
    if(derin && alt.length){ const k=document.querySelector('#answer .answer'); if(k) k.insertAdjacentHTML('afterbegin','<p class="small muted" style="margin:0 0 8px">Derin araştırma · aranan alt sorular: '+alt.map(esc).join(' · ')+'</p>'); }''')

PART = open('/home/claude/kira_ai/app/araclar.js.part').read()
r('''\nrvInit();\n''', '\n' + PART + '\nrvInit();\n')
open(P, 'w').write(s)
print('tamam', len(s))
