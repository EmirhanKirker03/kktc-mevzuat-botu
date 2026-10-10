import json
d=json.load(open('kira_denetim.json'))
ex=open('/home/claude/test_kiti/1_test_dava_dosyasi.txt').read().replace(' [SAYFA','\n[SAYFA')
ex+="\n[SAYFA 9] EK — DAVACI İLETİŞİM FORMU (UYDURMA) Ad soyad: Deniz Yalçınkaya. Kimlik no: 11111111110. Telefon: +90 533 000 00 00. E-posta: deniz.test@example.com. Adres: Örnek Sokak No: 1, Mağusa. Doğum tarihi: 1 Ocak 1990."
cat=json.load(open('catalog/catalog.json')); kar=json.load(open('kararlar.json')); mv=json.load(open('mevzuat_dalga1.json')); mv['yasalar'].append(json.load(open('mevzuat_kat.json'))); mv['yasalar']+=json.load(open('mevzuat_dalga2.json'))['yasalar']
enc=lambda o: json.dumps(o,ensure_ascii=False).replace('</','<\\/')
html=open('app/template.html').read()
html=html.replace('__YASA__',str(1+len(mv['yasalar']))).replace('__MADDE__',str(len(d['articles'])+sum(len(y['maddeler']) for y in mv['yasalar']))).replace('__KARAR__',str(len(kar['kararlar'])))
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
for k,v in [('__DATA__',d),('__EXAMPLE__',ex),('__CATALOG__',cat),('__KARARLAR__',meta),('__MEVZUAT__',mv)]: html=html.replace(k,enc(v))
print(alanlar)
open('app/pub/kira_asistani.html','w').write(html)
print(len(html)/1e6,'MB', 'madde:', len(d['articles'])+sum(len(y['maddeler']) for y in mv['yasalar']))
