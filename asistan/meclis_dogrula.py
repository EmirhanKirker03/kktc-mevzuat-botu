"""Meclis'ten alınan değişiklik yasalarının gerçekten ilgili yasayı değiştirip değiştirmediğini, dosyanın kendi başlığından doğrular.
Doğrulananlar: sonraki_degisiklikler.json (yasa pkey → değişiklik metni). Asistan bunları 'metne işlenmemiş değişiklik' olarak gösterir."""
import json,re,os,urllib.parse,difflib,hashlib
TR=str.maketrans('çğıöşüâîûÇĞİÖŞÜÂÎÛI','cgiosuaiuCGIOSUAIUI')
def n(s):
    s=s.replace('İ','i').replace('I','ı').lower().translate(TR)
    s=re.sub(r'\((degisiklik|degistirilmis|ek)[^)]*\)|\bno\s*:?\s*\d+','',s)
    s=re.sub(r'yasas[ıi]|yasa','',s)
    for w in ['dairesi','daire','kurulus','gorev','calisma','esaslari','esaslar','ve','kurumu']: s=re.sub(r'\b'+w+r'\b',' ',s)
    return re.sub(r'[^a-z]','',s)
h=json.load(open('raw/meclis_hedef.json'))
out={}; red=[]
for x in h:
    f=urllib.parse.unquote(x['url'].split('/')[-1]); t='raw/meclis2_txt/'+os.path.splitext(f)[0]+'.txt'
    s=open(t,encoding='utf-8',errors='replace').read().replace('﻿','')
    bas=s[:3000]
    # dosyadaki asıl başlık: "... (Değişiklik) Yasası" ilk geçtiği yer
    bas=re.sub(r'\s+',' ',bas)
    m=re.search(r'([A-ZÇĞİÖŞÜa-zçğıöşü][^“”"]{3,200}?\((?:DEĞİŞİKLİK|Değişiklik)[^)]*\)\s*(?:YASASI|Yasası))',bas)
    baslik=m.group(1).strip() if m else ''
    oran=difflib.SequenceMatcher(None,n(baslik),n(x['ad'])).ratio() if baslik else 0
    ok=oran>=0.93
    kayit={'ocr':f.endswith('.pdf'),'degisiklik':x['degisiklik'],'baslik':baslik,'url':x['url'],'sha256':hashlib.sha256(open('raw/meclis2/'+f,'rb').read()).hexdigest(),'benzerlik':round(oran,2)}
    if ok:
        metin=re.sub(r'[ \t]+',' ',s); metin=re.sub(r'\n\s*\n+','\n',metin).strip()
        kayit['metin']=metin
        out.setdefault(str(x['pkey']),[]).append(kayit)
    else: red.append((x['yasa'],x['ad'][:40],x['degisiklik'],baslik[:60],round(oran,2)))
print('DOĞRULANAN:')
for k,v in out.items(): print(' ',k,[(d['degisiklik'],d['baslik'][:50],d['benzerlik']) for d in v])
print('REDDEDİLEN (başka yasaya ait):',len(red))
for r in red: print(' ',r)
json.dump(out,open('sonraki_degisiklikler.json','w',encoding='utf-8'),ensure_ascii=False)
