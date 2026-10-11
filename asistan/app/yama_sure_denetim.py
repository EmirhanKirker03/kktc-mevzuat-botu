# Taslak ve sözleşme incelemesinde: süre/oran ifadeleri kaynakta geçiyor mu; hukuki iddia kaynaksız mı; var olmayan madde atfı
import sys
p='/home/claude/kira_ai/app/template.html'; s=open(p).read()
if 'function sureEksik' in s: sys.exit('zaten uygulanmış')
def r(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:90]); s=s.replace(old,new)
r("function taslakCiz(res, list, harita){", r"""// yalnızca süre ve oran ifadeleri (müvekkilin tutar ve tarihleri karışmasın)
const SURE_RE=/(?:\d+(?:[.,]\d+)?|(?:(?:bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|elli|altmış|yetmiş|seksen|doksan|yüz)\s*)+)\s*(?:gün|hafta|ay(?![a-zçğıöşü])|aylık|aydan|ayda|ayı|yıl|sene|saat)|(?:%|yüzde)\s*\d+(?:[.,]\d+)?/giu;
function sureEksik(metin, cites){ if(!cites.length) return []; const ifade=(String(metin).toLocaleLowerCase('tr').match(SURE_RE)||[]).join(' '); return ifade?eksikSayilar(ifade, cites):[]; }
window.__sureEksik=sureEksik;
const HUKUKI_RE=/(^|[^\p{L}])(madde|yasa|tüzü|emir|emri|nizam|fasıl)/iu;
function taslakCiz(res, list, harita){""")
r("""    const hukuki=/(^|[^\\p{L}])(madde|yasa|tüzü|emir|emri|nizam|fasıl)/iu.test(metin); if(hukuki && !cites.length) kaynaksiz++; hepsi.push(metin); return {metin, cites, hukuki};""",
  """    const hukuki=HUKUKI_RE.test(metin); if(hukuki && !cites.length) kaynaksiz++; hepsi.push(metin); const se=sureEksik(metin,cites); if(se.length) sureSorun++; return {metin, cites, hukuki, se};""")
r("""  const allowed=new Set(list.map(a=>a.cid)); let kaynaksiz=0; const hepsi=[];
  const bol=""","""  const allowed=new Set(list.map(a=>a.cid)); let kaynaksiz=0, sureSorun=0; const hepsi=[];
  const bol=""")
r("""+(p.cites.length?' '+p.cites.map(c=>citeBtn(c,'t-')).join(''):p.hukuki?' <span class="badge gone" contenteditable="false">kaynak gösterilmedi</span>':'')+'</p>'""",
  """+(p.cites.length?' '+p.cites.map(c=>citeBtn(c,'t-')).join(''):p.hukuki?' <span class="badge gone" contenteditable="false">kaynak gösterilmedi</span>':'')+(p.se.length?' <span class="badge gone" contenteditable="false">süre/oran kaynakta yok: '+esc(p.se.join(', '))+'</span>':'')+'</p>'""")
r("""  if(!unk.length && !kaynaksiz) h+='<div class="check ok"><b>Kaynak kontrolü geçti.</b><span>Hukuki dayanak içeren paragrafların hepsi bulunan maddelere bağlı; var olmayan madde numarası yok.</span></div>';""",
  """  if(sureSorun) h+='<div class="check bad"><b>'+sureSorun+' paragrafta dayanılan metinde geçmeyen süre veya oran var.</b><span>İşaretli süreleri resmî metinden kontrol edin.</span></div>';
  if(!unk.length && !kaynaksiz && !sureSorun) h+='<div class="check ok"><b>Kaynak kontrolü geçti.</b><span>Hukuki dayanak içeren paragrafların hepsi bulunan maddelere bağlı; var olmayan madde numarası yok; süre ve oranlar dayanılan metinlerde geçiyor.</span></div>';""")
# sözleşme incelemesi
r("""  const DER={yüksek:'gone',orta:'chg',düşük:'live'}; let bad=0, n=0, atilan=0;""","""  const DER={yüksek:'gone',orta:'chg',düşük:'live'}; let bad=0, n=0, atilan=0, kaynaksizR=0, sureR=0;""")
r("""  R.sort((a,b)=>['yüksek','orta','düşük'].indexOf(a.derece)-['yüksek','orta','düşük'].indexOf(b.derece));""",
  """  R.sort((a,b)=>['yüksek','orta','düşük'].indexOf(a.derece)-['yüksek','orta','düşük'].indexOf(b.derece));
  R.forEach(r=>{ const t=String(r.aciklama||'')+' '+String(r.oneri||''); r.hukuki=HUKUKI_RE.test(t); if(r.hukuki && !r.cites.length) kaynaksizR++; r.se=sureEksik(t, r.cites); if(r.se.length) sureR++; });
  const unkR=bilinmeyenAtif(R.map(r=>String(r.aciklama||'')+' '+String(r.oneri||'')).join(' ')+' '+(Array.isArray(res.eksikler)?res.eksikler.map(x=>x&&x.text||'').join(' '):''), list);""")
r("""(r.cites.length?' '+r.cites.map(c=>citeBtn(c,'f-')).join(''):' <span class="muted small">(mevzuat dayanağı yok: ticari değerlendirme)</span>')+'</div>'+""",
  """(r.cites.length?' '+r.cites.map(c=>citeBtn(c,'f-')).join(''):r.hukuki?' <span class="badge gone">hukuki iddia, kaynak gösterilmedi</span>':' <span class="muted small">(mevzuat dayanağı yok: ticari değerlendirme)</span>')+(r.se.length?' <span class="badge gone">süre/oran kaynakta yok: '+esc(r.se.join(', '))+'</span>':'')+'</div>'+""")
r("""  if(atilan) h+='<div class="check warn"><b>'+atilan+' eksik hüküm tespiti gösterilmedi.</b>""","""  if(unkR.length) h+='<div class="check bad"><b>Var olmayan madde atfı: '+esc(unkR.join(', '))+'.</b><span>Bulunan yasalarda bu numaralı madde yok.</span></div>';
  if(kaynaksizR) h+='<div class="check bad"><b>'+kaynaksizR+' riskte hukuki iddia var ama kaynak gösterilmedi.</b><span>Bu iddiaları resmî metinden kontrol edin.</span></div>';
  if(sureR) h+='<div class="check bad"><b>'+sureR+' riskte dayanılan metinde geçmeyen süre veya oran var.</b><span>İşaretli süreleri kontrol edin.</span></div>';
  if(atilan) h+='<div class="check warn"><b>'+atilan+' eksik hüküm tespiti gösterilmedi.</b>""")
open(p,'w').write(s); print('tamam')
