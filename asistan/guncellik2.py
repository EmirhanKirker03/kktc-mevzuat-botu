"""Meclis kataloğundaki 2005 sonrası değişiklik yasalarını, Yüksek Mahkeme yasalarına AD BİREBİR (ortak kalıplar hariç) eşleşerek bağlar
ve değişiklik sayısı metinde geçmiyorsa 'olası eskilik' listesine koyar. Fuzzy eşleştirme kullanılmaz (yanlış eşleşmeyi önlemek için)."""
import json,re,os,collections,urllib.parse
TR=str.maketrans('çğıöşüâîûÇĞİÖŞÜÂÎÛI','cgiosuaiuCGIOSUAIUI')
def n(s):
    s=s.replace('İ','i').replace('I','ı').lower().translate(TR)
    s=re.sub(r'\(\s*(degisiklik|degistirilmis|ek|duzeltme)[^)]*\)','',s)
    s=re.sub(r'\bno\s*:?\s*\d+\b','',s)
    s=re.sub(r'yasas[ıi]|yasa|kanunu|kanun','',s)
    return re.sub(r'[^a-z]','',s)
REPO='/home/claude/kktc-mevzuat-botu'; M=REPO+'/veri/mahkemeler'
cat=json.load(open('catalog/catalog.json'))
grup=collections.defaultdict(list)
for line in cat['tsv'].split('\n'):
    name,rest=line.split('\t',1)
    for x in rest.split('|'):
        m=re.match(r'^([ed])0*(\d+)[^/]*/(\d{4}):(.*)$',x)
        if m and m.group(1)=='d' and int(m.group(3))>=2005:
            f=m.group(4); t=re.match(r'^~(0?)(\w+)$',f); no,yr=m.group(2),m.group(3)
            file=(t.group(1)+no+'-'+yr+'.'+t.group(2)) if t else f
            grup[n(name)].append((f'{int(no)}/{yr}', 'http://cm.gov.ct.tr/Yasalar/'+urllib.parse.quote(file), name))
kayit=json.load(open(M+'/yasa-kayit.json')); lo=json.load(open(M+'/yasa-lo-kayit.json'))
ocr={}
for f in os.listdir(M+'/ocr-kayit'): ocr.update(json.load(open(M+'/ocr-kayit/'+f)))
esles=0; eksik=[]
for pk,k in kayit.items():
    p=lo.get(pk) if lo.get(pk,{}).get('durum')=='tamam' else (k if k.get('durum')=='tamam' else ocr.get(pk) if ocr.get(pk,{}).get('durum')=='tamam' else None)
    if not p: continue
    a=n(k['ad'])
    if a not in grup: continue
    esles+=1
    ym=re.search(r'(\d{4})',str(k['numara'])); yil=int(ym.group(1)) if ym else 0
    duz=re.sub(r'\s','',open(REPO+'/'+p['metin_dosyasi'],encoding='utf-8',errors='replace').read())
    for d,url,name in grup[a]:
        no,y=d.split('/')
        if int(y)<=yil: continue
        if not re.search(rf'(?<!\d)0?{no}/{y}',duz) and not re.search(rf'(?<!\d)0?{no}/{y[2:]}(?!\d)',duz):
            eksik.append({'pkey':int(pk),'yasa':k['numara'],'ad':k['ad'],'degisiklik':d,'meclis_baslik':name,'url':url})
print('ad birebir eşleşen yasa:',esles,'| metinde olmayan değişiklik:',len(eksik),'| etkilenen yasa:',len({e['pkey'] for e in eksik}))
json.dump(eksik,open('raw/meclis_hedef2.json','w'),ensure_ascii=False,indent=0)
