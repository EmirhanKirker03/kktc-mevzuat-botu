import json
d=json.load(open('kira_denetim.json'))
ex=open('/home/claude/test_kiti/1_test_dava_dosyasi.txt').read().replace(' [SAYFA','\n[SAYFA')
ex+="\n[SAYFA 9] EK — DAVACI İLETİŞİM FORMU (UYDURMA) Ad soyad: Deniz Yalçınkaya. Kimlik no: 11111111110. Telefon: +90 533 000 00 00. E-posta: deniz.test@example.com. Adres: Örnek Sokak No: 1, Mağusa. Doğum tarihi: 1 Ocak 1990."
cat=json.load(open('catalog/catalog.json')); kar=json.load(open('kararlar.json')); mv=json.load(open('mevzuat_dalga1.json')); mv['yasalar'].append(json.load(open('mevzuat_kat.json'))); mv['yasalar']+=json.load(open('mevzuat_dalga2.json'))['yasalar']
enc=lambda o: json.dumps(o,ensure_ascii=False).replace('</','<\\/')
html=open('app/template.html').read()
_td=json.load(open('app/pub/tum-dizin.json'))['yasalar']
_say=lambda n: f'{n:,}'.replace(',', '.')
html=html.replace('__TUMYASA__',_say(sum(1 for y in _td if not y.get('tz') and not y.get('yg') and y.get('p')!='AY'))).replace('__TUMTUZUK__',_say(sum(1 for y in _td if y.get('tz') and y.get('rt') in (None,'tuzuk')))).replace('__TUMIKINCIL__',_say(sum(1 for y in _td if y.get('yg') or y.get('rt') in ('emirname','yonetmelik','teblig'))))
import os, re, datetime
# "Güncel" tarihi: Resmî Gazete dizinindeki son sayının tarihi ile Yüksek Mahkeme yasa/tüzük/karar listelerinin
# alındığı günlerden en eskisi (her kaynak en az bu tarihe kadar kontrol edildi; KKTC saati UTC+3)
AYLAR = 'Ocak Şubat Mart Nisan Mayıs Haziran Temmuz Ağustos Eylül Ekim Kasım Aralık'.split()
def gazete_tarihi(t, yil):
    """Basımevi dizinindeki tarih yazımları düzensiz: '31.10.2026', '9.10.2026', '17/06/2026', '22..04.2026', '12.102026'."""
    m = re.fullmatch(r'\s*(\d{1,2})\D+(\d{1,2})\D*(\d{4})\s*', t or '')
    if not m or int(m[3]) != yil: return None
    try: return datetime.date(int(m[3]), int(m[2]), int(m[1]))
    except ValueError: return None
def guncel_tarih():
    burasi = os.path.dirname(os.path.realpath(__file__))
    rl = json.load(open(os.path.join(burasi, 'raw/resmi_gazete/rg_liste.json'), encoding='utf-8'))
    yil = max(int(y) for y in rl if rl[y])
    tarihler = [max(filter(None, (gazete_tarihi(s.get('t'), yil) for s in rl[str(yil)])))]
    for t in ('yasa', 'tuzuk', 'karar'):
        a = json.load(open(os.path.join(os.path.dirname(burasi), 'liste', f'mahkemeler-{t}.json'), encoding='utf-8'))['alindi']
        a = datetime.datetime.fromisoformat(a.replace('Z', '+00:00'))
        tarihler.append((a.astimezone(datetime.timezone(datetime.timedelta(hours=3))) if a.tzinfo else a).date())
    g = min(tarihler)
    return f'{g.day} {AYLAR[g.month - 1]} {g.year}'
GUNCEL = guncel_tarih()
html=html.replace('__GUNCEL__',GUNCEL)
html=html.replace('__YASA__',str(1+len(mv['yasalar']))).replace('__MADDE__',str(len(d['articles'])+sum(len(y['maddeler']) for y in mv['yasalar']))).replace('__KARAR__',f"{len(kar['kararlar']):,}".replace(',', '.'))
import os
os.makedirs('app/pub',exist_ok=True)
alanlar={}
import glob
for f in glob.glob('app/pub/kararlar-*.json')+glob.glob('app/pub/karar-*.json'): os.remove(f)
# kararlar: küçük künye dizini + metin paketleri (yalnızca gereken paketler indirilir)
SIRA = ['KIRA','AILE','IS','TUKETICI','TRAFIK','KAT','CEZA','BORCLAR','USUL','MIRAS','SIRKET','IDARE','ANAYASA','SECIM','AIHM','DIGER']
ks = sorted(kar['kararlar'], key=lambda k: (SIRA.index(k['alanlar'][0]) if k['alanlar'][0] in SIRA else 99, k['tarih'] or ''))
paketler, pk, boy = [], {}, 0
dizin = []
for k in ks:
    b = len(k['metin'].encode())
    if boy + b > 1_500_000 and pk: paketler.append(pk); pk, boy = {}, 0
    pk[k['id']] = k['metin']; boy += b
    m = {x: v for x, v in k.items() if x != 'metin'}
    if m.get('ozet') and len(m['ozet']) > 700: m['ozet'] = m['ozet'][:700] + ' …'
    m['b'] = len(paketler); dizin.append(m)
if pk: paketler.append(pk)
for i_, p_ in enumerate(paketler): json.dump(p_, open(f'app/pub/karar-p{i_}.json','w',encoding='utf-8'), ensure_ascii=False)
json.dump({'kaynak':kar['kaynak'],'alindi':kar['alindi'],'kararlar':dizin}, open('app/pub/karar-dizin.json','w',encoding='utf-8'), ensure_ascii=False)
alanlar={a:{'adet':sum(1 for k in ks if a in k['alanlar'])} for a in SIRA}
print('karar paketi', len(paketler), 'dizin MB', round(os.path.getsize('app/pub/karar-dizin.json')/1e6,2))
meta={'alindi':kar['alindi'],'baslangic':kar['baslangic'],'alanlar':alanlar}
for k,v in [('__DATA__',d),('__EXAMPLE__',ex),('__CATALOG__',cat),('__KARARLAR__',meta),('__MEVZUAT__',mv),('__ARACLAR__',json.load(open('araclar.json')))]: html=html.replace(k,enc(v))
print(alanlar)
open('app/pub/kira_asistani.html','w').write(html)
print('güncel:', GUNCEL); print(len(html)/1e6,'MB', 'madde:', len(d['articles'])+sum(len(y['maddeler']) for y in mv['yasalar']))
