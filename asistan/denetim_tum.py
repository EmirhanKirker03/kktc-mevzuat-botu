"""Yayın verisinin tutarlılık denetimi: dizin ↔ paket, boş/kısa metin, yinelenen kayıt, başlık sorunları, karar alanları."""
import json, glob, os, re, sys, collections
pub = sys.argv[1] if len(sys.argv) > 1 else 'app/pub'
S = collections.Counter(); ORN = collections.defaultdict(list)
def kaydet(tur, x):
    S[tur] += 1
    if len(ORN[tur]) < 6: ORN[tur].append(x)
dz = json.load(open(os.path.join(pub, 'tum-dizin.json')))['yasalar']
paket = {}
for f in glob.glob(os.path.join(pub, 'tum-*.json')):
    b = os.path.basename(f)[4:-5]
    if b == 'dizin': continue
    for k, ms in json.load(open(f)).items(): paket[k] = (b, ms)
gor = set()
for x in dz:
    p = str(x['p'])
    if p in gor: kaydet('yinelenen p', p)
    gor.add(p)
    if not x.get('a') or len(x['a']) < 4: kaydet('başlık boş/kısa', (p, x.get('a')))
    elif re.search(r'[-~^\\{}]|\s{2,}', x['a']): kaydet('başlıkta tuhaf karakter', (p, x['a']))
    if x['a'] and x['a'].strip() != x['a']: kaydet('başlıkta boşluk', (p, x['a']))
    if x.get('b', -1) == -1:
        if p not in paket and not x.get('elle'): kaydet('dizinde var paket yok (b=-1)', p)
        continue
    if p not in paket: kaydet('dizinde var paket yok', (p, x['b'])); continue
    if str(x['b']) != paket[p][0]: kaydet('paket numarası yanlış', (p, x['b'], paket[p][0]))
    ms = paket[p][1]
    if not ms: kaydet('boş madde listesi', p)
    nos = [m.get('no') for m in ms]
    for no, c in collections.Counter(nos).items():
        if c > 1 and not str(no).startswith('Parça'): kaydet('yinelenen madde no', (p, no, c))
    for m in ms:
        t = m.get('metin', '')
        if not t.strip(): kaydet('boş madde metni', (p, m.get('no')))
        elif len(t.strip()) < 15 and not m.get('sd'): kaydet('çok kısa madde', (p, m.get('no'), t.strip()))
        if '�' in t: kaydet('U+FFFD', (p, m.get('no')))
        if re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', t): kaydet('denetim karakteri', (p, m.get('no')))
        if re.search(r'[-]', t): kaydet('özel alan karakteri', (p, m.get('no')))
        if len(t) > 60000: kaydet('çok uzun madde', (p, m.get('no'), len(t)))
for p in paket:
    if p not in gor: kaydet('pakette var dizinde yok', p)
# kararlar
kd = json.load(open(os.path.join(pub, 'karar-dizin.json')))
kl = kd if isinstance(kd, list) else kd.get('kararlar') or kd.get('k') or list(kd.values())[-1]
S['karar dizin'] = len(kl) if isinstance(kl, list) else -1
if isinstance(kl, list):
    ids = collections.Counter(str(x.get('id') or x.get('i') or '') for x in kl if isinstance(x, dict))
    for i, c in ids.items():
        if c > 1: kaydet('yinelenen karar id', (i, c))
    for x in kl[:]:
        if not isinstance(x, dict): continue
        for alan in x:
            pass
    alanlar = collections.Counter(a for x in kl if isinstance(x, dict) for a in x)
    print('karar dizin alanları', dict(alanlar))
for k, v in S.items(): print(k, v, ORN.get(k, '')[:6])
