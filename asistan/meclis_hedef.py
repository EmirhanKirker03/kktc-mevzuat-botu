import json,re,urllib.parse
c=json.load(open('catalog/catalog.json'))
items={}
for line in c['tsv'].split('\n'):
    name,rest=line.split('\t',1)
    for x in rest.split('|'):
        m=re.match(r'^([ed])([^/]*)/(\d+):(.*)$',x)
        if not m: continue
        k,no,yr,f=m.groups(); t=re.match(r'^~(0?)(\w+)$',f)
        file=t.group(1)+no+'-'+yr+'.'+t.group(2) if t else f
        n=re.match(r'0*(\d+)',no)
        if n: items.setdefault(f'{int(n.group(1))}/{yr}',[]).append((k,name,file))
g=json.load(open('guncellik_tum.json'))
hedef=[]
for x in g:
    if x['durum']!='eksik': continue
    for d in x['metinde_yok']:
        for k,name,file in items.get(d,[]):
            if k=='d': hedef.append({'pkey':x['pkey'],'yasa':x['numara'],'ad':x['ad'],'degisiklik':d,'meclis_baslik':name,'url':'http://cm.gov.ct.tr/Yasalar/'+urllib.parse.quote(file)})
for k,n,f in items['13/2013']:
    hedef.append({'pkey':277,'yasa':'Fasıl 6','ad':'Hukuk Muhakemeleri Usulü Yasası','degisiklik':'13/2013','meclis_baslik':n,'url':'http://cm.gov.ct.tr/Yasalar/'+urllib.parse.quote(f)})
print(len(hedef),'kayıt',len({h['url'] for h in hedef}),'benzersiz dosya')
json.dump(hedef,open('raw/meclis_hedef.json','w'),ensure_ascii=False,indent=0)
print(items['13/2013'])
