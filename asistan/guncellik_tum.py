"""Otomatik eklenen yasaların Yüksek Mahkeme metni, Meclis kataloğundaki 2005 sonrası değişiklikleri içeriyor mu?
Meclis kataloğu (catalog.json) her yasa başlığı için esas yasa (e) ve değişiklik yasalarını (d) listeler.
Eşleştirme yasa adına göre yapılır (ad benzerliği ≥ 0.85); emin olunamayanlar 'eşleşmedi' sayılır."""
import json, re, os, difflib, collections
D = os.path.dirname(os.path.abspath(__file__)); REPO = '/home/claude/kktc-mevzuat-botu'; M = REPO + '/veri/mahkemeler'
cat = json.load(open(D + '/catalog/catalog.json'))
TR = str.maketrans('çğıöşüâîûÇĞİÖŞÜÂÎÛI', 'cgiosuaiuCGIOSUAIUI')
def n(s):
    s = s.replace('İ', 'i').replace('I', 'ı').lower().translate(TR)
    s = re.sub(r'\(\s*(degisiklik|degistirilmis|ek|onay)[^)]*\)', ' ', s)
    s = re.sub(r'yasa(si|lari)?|kanun(u)?', ' ', s)
    return re.sub(r'[^a-z]', '', s)
gr = collections.defaultdict(set)
for l in cat['tsv'].split('\n'):
    if '\t' not in l: continue
    t, its = l.split('\t', 1)
    for it in its.split('|'):
        m = re.match(r'^d0*(\d+)/(\d{4})', it)
        if m: gr[n(t)].add((int(m.group(2)), int(m.group(1))))
keys = list(gr)
kayit = json.load(open(M + '/yasa-kayit.json')); lo = json.load(open(M + '/yasa-lo-kayit.json'))
ocr = {}
for f in os.listdir(M + '/ocr-kayit'): ocr.update(json.load(open(M + '/ocr-kayit/' + f)))
sonuc = []
for pk, k in kayit.items():
    p = lo.get(pk) if lo.get(pk, {}).get('durum') == 'tamam' else (k if k.get('durum') == 'tamam' else ocr.get(pk) if ocr.get(pk, {}).get('durum') == 'tamam' else None)
    if not p: continue
    a = n(k['ad'])
    if not a: continue
    best = difflib.get_close_matches(a, keys, n=1, cutoff=0.85)
    if not best: sonuc.append({'pkey': int(pk), 'numara': k['numara'], 'ad': k['ad'], 'durum': 'eşleşmedi'}); continue
    ym = re.search(r'/(\d{4})', k['numara'] or '') or re.search(r'-(\d{4})', k['numara'] or '')
    yil = int(ym.group(1)) if ym else 0
    ds = sorted(x for x in gr[best[0]] if x[0] >= 2005 and x[0] > yil)
    duz = re.sub(r'\s', '', open(REPO + '/' + p['metin_dosyasi'], encoding='utf-8', errors='replace').read())
    eksik = [f'{no}/{y}' for y, no in ds if not re.search(rf'(?<!\d)0?{no}/{y}', duz)]
    sonuc.append({'pkey': int(pk), 'numara': k['numara'], 'ad': k['ad'], 'durum': 'eksik' if eksik else 'tamam', 'degisiklikler': [f'{no}/{y}' for y, no in ds], 'metinde_yok': eksik})
c = collections.Counter(x['durum'] for x in sonuc)
print(c, 'en az bir 2005+ değişikliği olan:', sum(1 for x in sonuc if x.get('degisiklikler')))
json.dump(sonuc, open(D + '/guncellik_tum.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
for x in [x for x in sonuc if x['durum'] == 'eksik'][:15]: print(x['numara'], x['ad'][:50], 'metinde yok:', x['metinde_yok'])
