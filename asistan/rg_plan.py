"""Yüksek Mahkeme sisteminde yalnızca taranmış (yazı tanıma ile okunmuş) olan tüzükleri Resmî Gazete dizininde
(rg_liste.json: sayı → Ek III maddeleri, A.E. no) bulur. Çıktı: dogrulama_plan.json (rg_dogrula.py girdisi) ve
indirilecek.json (metni henüz indirilmemiş Gazete sayıları)."""
import json, re, os
K = '/home/claude/rg'
l = json.load(open(os.path.join(K, 'rg_liste.json')))
idx = {}
for yil, iss in l.items():
    for s in iss:
        for it in s['i']:
            if not it[0].startswith('EK III'): continue
            m = re.search(r'(\d+)', it[1] or '')
            if m: idx.setdefault((int(m.group(1)), yil), []).append((s['u'], it[2]))
dz = json.load(open('/home/claude/kira_ai/app/pub/tum-dizin.json'))['yasalar']
def key(n):
    m = re.search(r'(\d+)\s*[-/]\s*(\d{4})', str(n)); return (int(m.group(1)), m.group(2)) if m else None
plan, ind = [], set()
for y in dz:
    if not (y.get('tz') and not y.get('ks') and y.get('o')): continue
    k = key(y['n'])
    if not k or k not in idx: continue
    u = idx[k][0][0]
    plan.append({'p': y['p'], 'n': y['n'], 'a': y['a'], 'ae': '%d/%s' % k, 'u': u, 'rgad': idx[k][0][1]})
    if not os.path.exists(os.path.join(K, 'metin', re.sub(r'\?.*', '', u).replace('/Portals/', '').replace('/', '_') + '.txt')): ind.add(u)
json.dump(plan, open(os.path.join(K, 'dogrulama_plan.json'), 'w'), ensure_ascii=False)
json.dump(sorted(ind), open(os.path.join(K, 'indirilecek.json'), 'w'))
print(len(plan), 'tüzük;', len(ind), 'sayı indirilecek')
