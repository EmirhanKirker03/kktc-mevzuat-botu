"""Kullanım kolaylığı yaması: tek 'Cevapla' düğmesi (derin araştırma gerektiğinde kendiliğinden / cevaptan sonra isteğe bağlı),
'prototip' ifadeleri kaldırıldı, Türkçe büyük harf (lang=tr), telefonda örnek sorular alt alta, ilk açılışta 3 adımlık tanıtım."""
import sys
p = sys.argv[1] if len(sys.argv) > 1 else 'template.html'
s = open(p, encoding='utf-8').read()
def degis(eski, yeni, say=1):
    global s
    assert s.count(eski) == say, (eski[:90], s.count(eski))
    s = s.replace(eski, yeni)

if 'id="tanitim"' not in s:
    # 1) Tek düğme: 'Ayrıntılı araştır' gizlenir (işlev korunur); uzun/çok parçalı sorularda kendiliğinden derin araştırma
    degis('<button class="btn ghost" id="derinbtn" type="button"', '<button class="btn ghost" id="derinbtn" type="button" hidden')
    degis("const derin=$('#derin').checked && !!sampleFn;",
          "const derin=($('#derin').checked || otoDerin(q)) && !!sampleFn;")
    degis("async function run(){",
          "// Uzun veya birden çok soru içeren metinler alt sorulara bölünerek araştırılır (kullanıcının seçim yapması gerekmez)\n"
          "const otoDerin=q=>q.length>260 || (q.match(/\\?/g)||[]).length>=2 || /\\b(ayrıca|bunun yanında|hem de)\\b/i.test(q) && q.length>140;\n"
          "async function run(){")
    degis("    if(derin && alt.length){ const k=document.querySelector('#answer .answer');",
          "    if(!derin){ const k=document.querySelector('#answer .answer'); if(k) k.insertAdjacentHTML('beforeend','<p class=\"small\" style=\"margin:12px 0 0\"><button type=\"button\" class=\"linkbtn\" id=\"derinlink\">Daha kapsamlı araştır</button> <span class=\"muted\">· soru alt sorulara bölünüp yeniden aranır; daha yavaştır ve günlük haktan 2 sayılır</span></p>'); }\n"
          "    if(derin && alt.length){ const k=document.querySelector('#answer .answer');")
    degis("$('#derinbtn').addEventListener('click',()=>{ $('#derin').checked=true; run(); $('#derin').checked=false; });",
          "$('#derinbtn').addEventListener('click',()=>{ $('#derin').checked=true; run(); $('#derin').checked=false; });\n"
          "$('#answer').addEventListener('click',e=>{ if(e.target.closest('#derinlink')){ const son=SOHBET.pop(); if(son) $('#q').value=son.q; if(!SOHBET.length) $('#devam').hidden=true; $('#derin').checked=true; run(); $('#derin').checked=false; } });")
    # 2) 'prototip' ifadeleri ve eski kapsam cümleleri
    degis('<span>prototip · tavsiye değildir</span>', '<span>Hukuki tavsiye değildir</span>')
    degis("Soru başka bir yasaya, sözleşme hükmüne veya mahkeme içtihadına bağlı olabilir. Bu prototip şu yasaları kapsar: '+esc(LAWS.map(l=>l.ad).join(', '))+'.</p>';",
          "Soruyu farklı kelimelerle veya daha ayrıntılı yazmayı deneyin; konu bir sözleşme hükmüne ya da yayımlanmamış bir karara bağlı olabilir.</p>';")
    degis("<p>Kapsanan yasalarda ('+esc(LAWS.map(l=>l.kisa).join(', '))+') bu konuda madde bulunamadı. Soru sözleşme hükümlerine veya henüz eklenmemiş bir yasaya bağlı olabilir.</p>",
          "<p>Yasalarda, tüzüklerde ve kararlarda bu soruyla eşleşen bir madde bulunamadı. Soruyu farklı kelimelerle yazmayı deneyin (ör. hukuki terim yerine olayı anlatın).</p>")
    # 3) Türkçe büyük harf dönüşümü (DİĞER, ÖRNEK SORULAR) için dil bilgisi
    degis('<nav class="nav" role="tablist" aria-label="Bölümler">', '<nav class="nav" lang="tr" role="tablist" aria-label="Bölümler">')
    # 4) Telefonda örnek sorular yana kaymasın: alt alta 4 tanesi görünsün
    degis("@media (max-width:820px){.examples .chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}.examples .chip{white-space:nowrap;flex:none}",
          "@media (max-width:820px){.examples .chips{flex-direction:column;align-items:stretch}.examples .chip{white-space:normal;text-align:left}.examples .chip:nth-child(n+5){display:none}")
    # 5) Sayaç: yasa / tüzük / kararname ayrı (build_app doldurur)
    degis('<div class="stat2">__TUMYASA__ yasa · __TUMTUZUK__ tüzük · __KARAR__ karar<br>Güncel: Ekim 2026</div>',
          '<div class="stat2">Anayasa ve __TUMYASA__ yasa · __TUMTUZUK__ tüzük · __TUMIKINCIL__ kararname, emirname ve yönetmelik · __KARAR__ mahkeme kararı<br>Güncel: Ekim 2026 · <button type="button" class="linkbtn" id="tanitac" style="color:inherit">Nasıl kullanılır?</button></div>')
    degis('<div class="topbar"><b>KKTC Hukuk Asistanı</b><span>Hukuki tavsiye değildir</span></div>',
          '<div class="topbar"><b>KKTC Hukuk Asistanı</b><span>Hukuki tavsiye değildir</span><button type="button" class="linkbtn" id="tanitac2" aria-label="Nasıl kullanılır">?</button></div>')
    # 6) İlk açılışta 3 adımlık tanıtım
    degis('</style>', '''
.tanit{position:fixed;inset:0;z-index:60;background:rgba(10,20,18,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.tanit[hidden]{display:none}
.tanit .kart{background:var(--sheet);color:var(--ink);border-radius:12px;max-width:460px;width:100%;padding:22px 22px 16px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.tanit .adim{font-size:12px;color:var(--muted);letter-spacing:.04em}
.tanit h3{font-family:var(--f-display);font-weight:650;font-size:21px;margin:6px 0 8px}
.tanit p{margin:0 0 8px;line-height:1.55}
.tanit ul{margin:0 0 8px;padding-left:18px;line-height:1.55}
.tanit .alt{display:flex;justify-content:space-between;align-items:center;margin-top:14px;gap:8px}
.tanit .noktalar{display:flex;gap:6px}.tanit .noktalar i{width:8px;height:8px;border-radius:50%;background:var(--rule-2)}.tanit .noktalar i.on{background:var(--seal)}
.linkbtn{background:none;border:0;padding:0;font:inherit;color:var(--seal);text-decoration:underline;cursor:pointer}
.tanit .adim{padding:0;margin:0;text-indent:0}
@media (max-width:820px){.topbar b{white-space:nowrap;font-size:17px}.topbar span{white-space:nowrap}}
.topbar .linkbtn{text-decoration:none;font-weight:600;border:1px solid var(--rule-2);border-radius:999px;width:24px;height:24px;line-height:22px;text-align:center;flex:none}
</style>''')
    degis('<div class="topbar">', '''<div class="tanit" id="tanitim" hidden role="dialog" aria-modal="true" aria-labelledby="tanit-baslik"><div class="kart">
  <div class="adim" id="tanit-adim">1 / 3</div><h3 id="tanit-baslik"></h3><div id="tanit-icerik"></div>
  <div class="alt"><button type="button" class="linkbtn" id="tanit-gec">Geç</button><div class="noktalar" id="tanit-nokta"><i></i><i></i><i></i></div><button type="button" class="btn" id="tanit-ileri">İleri</button></div>
</div></div>
<div class="topbar">''')
    degis("$('#ask').addEventListener('click',run);", """$('#ask').addEventListener('click',run);
/* ---------- ilk açılış tanıtımı (3 adım) ---------- */
const TANIT=[
  ['Sorunuzu yazın, cevabı kaynağıyla alın', '<p>Soruyu günlük dille yazıp <b>Cevapla</b>’ya basın. Ör. “Kiracı 3 aydır kira ödemiyor, ne yapabilirim?”</p><ul><li>Cevaptaki her cümlenin yanında dayandığı <b>yasa maddesi</b> veya <b>Yüksek Mahkeme kararı</b> vardır; tıklayınca metni açılır.</li><li>Sonra takip sorusu sorabilirsiniz; önceki soruyu hatırlar.</li></ul>'],
  ['Belge hazırlayın veya inceletin', '<ul><li><b>Belge hazırla:</b> Olayı ve tarafları yazın; dilekçe, ihtarname veya sözleşme taslağı çıkar, Word olarak indirirsiniz.</li><li><b>Belge incele:</b> Bir sözleşmeyi ya da karşı tarafın dilekçesini yapıştırın veya yükleyin; riskli ve yasaya aykırı maddeler işaretlenir.</li><li>Kişi adları ve kimlik bilgileri yapay zekâya gönderilmeden önce otomatik gizlenir.</li></ul>'],
  ['Süreler, mevzuat ve kararlar', '<ul><li><b>Süre hesapla:</b> Tebliğ tarihini girin; istinaf, cevap gibi usul süreleri ve son gün hesaplanır.</li><li><b>Mevzuat</b> ve <b>Kararlar:</b> Anayasa, yasalar, tüzükler ve 5.000’i aşkın Yüksek Mahkeme kararında doğrudan arama.</li></ul><p class="small muted">Uygulama hukuki tavsiye vermez; önemli işlerde maddeyi resmî metinden kontrol edin.</p>']];
let tanitI=0;
function tanitGoster(i){ tanitI=i; const [b,c]=TANIT[i]; $('#tanit-baslik').textContent=b; $('#tanit-icerik').innerHTML=c; $('#tanit-adim').textContent=(i+1)+' / '+TANIT.length;
  [...$('#tanit-nokta').children].forEach((n,k)=>n.classList.toggle('on',k===i)); $('#tanit-ileri').textContent=i===TANIT.length-1?'Başla':'İleri'; $('#tanitim').hidden=false; $('#tanit-ileri').focus(); }
function tanitKapat(){ $('#tanitim').hidden=true; try{ localStorage.setItem('tanitimGoruldu','1'); }catch(e){} $('#q').focus(); }
$('#tanit-ileri').addEventListener('click',()=>{ tanitI<TANIT.length-1?tanitGoster(tanitI+1):tanitKapat(); });
$('#tanit-gec').addEventListener('click',tanitKapat);
$('#tanitim').addEventListener('keydown',e=>{ if(e.key==='Escape') tanitKapat(); });
['#tanitac','#tanitac2'].forEach(s=>{ const b=$(s); if(b) b.addEventListener('click',()=>tanitGoster(0)); });
(()=>{ let g=null; try{ g=localStorage.getItem('tanitimGoruldu'); }catch(e){} if(!g && !navigator.webdriver && !/[?&]tanitimsiz/.test(location.search)) setTimeout(()=>tanitGoster(0),300); })();""")
    # genel dil bilgisi (büyük harf dönüşümleri için)
    degis("/* ---------- ilk açılış tanıtımı (3 adım) ---------- */", "try{ document.documentElement.lang='tr'; }catch(e){}\n/* ---------- ilk açılış tanıtımı (3 adım) ---------- */")
if 'güncel kira yasası dönemi' not in s:
    degis('<span class="badge live">27/2011 sonrası</span>', '<span class="badge live" title="Karar, 27/2011 sayılı değişiklikten sonra verilmiştir">güncel kira yasası dönemi</span>')
    degis('<span class="badge chg">1981–2011 · 27/2011 öncesi</span>', '<span class="badge chg" title="Karar 2011 değişikliğinden önce verilmiştir; bazı kurallar değişmiş olabilir">2011 değişikliği öncesi</span>')
    degis('<span class="badge gone">1981 öncesi · eski kira mevzuatı</span>', '<span class="badge gone" title="Yürürlükten kalkmış eski kira mevzuatı dönemi">1981 öncesi · eski yasa</span>')
    degis('Kaynak: KKTC Yüksek Mahkeme mevzuat sistemi ve Cumhuriyet Meclisi arşivi, Ekim 2026.', 'Kaynak: KKTC Yüksek Mahkeme mevzuat sistemi, Cumhuriyet Meclisi arşivi ve Resmî Gazete (Devlet Basımevi), Ekim 2026.')
open(p, 'w', encoding='utf-8').write(s)
print('yama_kolay tamam')
