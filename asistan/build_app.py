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
for f in glob.glob('app/pub/kararlar-*.json'): os.remove(f)
for a in ['KIRA','AILE','IS','TUKETICI','TRAFIK','KAT','CEZA','BORCLAR','USUL','MIRAS','SIRKET']:
    xs=[x for x in kar['kararlar'] if a in x['alanlar']]
    top=sum(len(x['metin'].encode()) for x in xs); np_=max(1,-(-top//6_000_000))
    parcalar=[xs[i::np_] for i in range(np_)]
    adlar=[f'kararlar-{a}.json'] if np_==1 else [f'kararlar-{a}-{i+1}.json' for i in range(np_)]
    for ad,ps in zip(adlar,parcalar):
        json.dump({'alan':a,'kaynak':kar['kaynak'],'alindi':kar['alindi'],'kararlar':ps},open('app/pub/'+ad,'w',encoding='utf-8'),ensure_ascii=False)
    alanlar[a]={'adet':len(xs),'parca':np_,'bayt':sum(os.path.getsize('app/pub/'+ad) for ad in adlar)}
meta={'alindi':kar['alindi'],'baslangic':kar['baslangic'],'alanlar':alanlar}
for k,v in [('__DATA__',d),('__EXAMPLE__',ex),('__CATALOG__',cat),('__KARARLAR__',meta),('__MEVZUAT__',mv)]: html=html.replace(k,enc(v))
print(alanlar)
open('app/pub/kira_asistani.html','w').write(html)
print(len(html)/1e6,'MB', 'madde:', len(d['articles'])+sum(len(y['maddeler']) for y in mv['yasalar']))
