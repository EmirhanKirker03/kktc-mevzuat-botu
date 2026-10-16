"""Yüksek Mahkeme sisteminde yalnızca taranmış (yazı tanıma ile okunmuş) olan tüzüklerin Resmî Gazete'deki
dijital (metin katmanlı) yayımını bulur ve karşılaştırır. Çıktı: rg_dogrula.json — her tüzük için Gazete parçası,
dijital mi, YM metniyle benzerlik."""
import json, re, os, sys, collections, glob, difflib
K = '/home/claude/rg'
src = open('/home/claude/kira_ai/rg_bol.py', encoding='utf-8').read().split("hedef = json.load")[0]
exec(src)
l = json.load(open(os.path.join(K, 'rg_liste.json')))
issue_items = collections.defaultdict(list)
for yil, iss in l.items():
    for s in iss:
        for it in s['i']:
            if not it[0].startswith('EK III'): continue
            m = re.search(r'(\d+)', it[1] or '')
            if m: issue_items[s['u']].append({'ae': '%d/%s' % (int(m.group(1)), yil), 'baslik': it[2], 'u': s['u']})
plan = json.load(open(os.path.join(K, 'dogrulama_plan.json')))
yap = set(json.load(open(os.path.join(K, 'ocr_yapildi.json'))))
P = {}
for f in glob.glob('/home/claude/kira_ai/app/pub/tum-*.json'):
    if 'dizin' in f: continue
    P.update(json.load(open(f)))
def bozuk(t):
    w = re.findall(r'\S+', t)
    return sum(1 for x in w if re.search(r'[~·•|\\{}<>^¡¿]|[a-zçğıöşü][A-ZÇĞİÖŞÜ]{2}|\d[a-zçğıöşü]{2,}\d', x)) / max(1, len(w))
def harf(t): return re.sub(r'[^a-zçğıöşü]', '', t.replace('İ', 'i').replace('I', 'ı').lower())
hedefler = collections.defaultdict(list)
for x in plan: hedefler[x['u']].append(x)
out, ist = [], collections.Counter()
for u, xs in hedefler.items():
    f = os.path.join(K, 'metin', re.sub(r'\?.*', '', u).replace('/Portals/', '').replace('/', '_') + '.txt')
    if not os.path.exists(f): ist['metin yok'] += len(xs); continue
    t, segs = bolumler(open(f, encoding='utf-8').read())
    its = issue_items[u]
    puanlar = []
    for zi, z in enumerate(its):
        bt = toks(re.sub(r'^.*?YASASI\s*[-–]\s*', '', z['baslik'])) or toks(z['baslik'])
        for k, (a, b) in enumerate(segs):
            bas = toks(t[a:min(b, a + 900)])
            ism = re.search(r'Bu\s+(?:T[üu]z[üu]k|Emirname|Y[öo]netmelik|Tebli[ğg])\s*,?([\s\S]{0,400}?)(?:isimlendiril|olarak an[ıi]l)', t[a:min(b, a + 4000)])
            if ism: bas |= toks(ism.group(1))
            p = len(bt & bas) / max(1, len(bt))
            if p >= 0.6 and len(bt & toks(t[a:min(b, a + 3000)])) < 0.3 * len(bt): p = 0
            puanlar.append((p, zi, k))
    atandi, kullan = {}, set()
    for p, zi, k in sorted(puanlar, reverse=True):
        if p < 0.6 or zi in atandi or k in kullan: continue
        atandi[zi] = (k, p); kullan.add(k)
    aemap = {z['ae']: zi for zi, z in enumerate(its)}
    for x in xs:
        zi = aemap.get(x['ae'])
        if zi is None or zi not in atandi: ist['eşleşmedi'] += 1; out.append(dict(x, durum='eşleşmedi')); continue
        k, p = atandi[zi]; a, b = segs[k]; mt = kirp(t[a:b]).strip()
        ym = '\n'.join(m['metin'] for m in P.get(str(x['p']), []))
        dij = re.sub(r'\?.*', '', u) not in yap and bozuk(mt) <= 0.02
        h1, h2 = harf(mt), harf(ym)
        sm = difflib.SequenceMatcher(None, h1[:6000], h2[:6000], autojunk=False)
        oran = sm.ratio()
        ist['dijital' if dij else 'gazete de taranmış'] += 1
        out.append(dict(x, durum='eşleşti', dijital=dij, puan=round(p, 2), benzerlik=round(oran, 3), uz_rg=len(h1), uz_ym=len(h2), metin=mt))
json.dump(out, open(os.path.join(K, 'rg_dogrula.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(dict(ist))
b = [x['benzerlik'] for x in out if x.get('dijital')]
import statistics
if b: print('benzerlik dağılımı', [round(statistics.quantiles(b, n=10)[i], 2) for i in range(9)])
