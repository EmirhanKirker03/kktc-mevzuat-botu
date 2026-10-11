# parça moduna düşen yasaların hangi denetimde takıldığını gösterir
import json, re, sys, os, collections
sys.path.insert(0, '.')
from sirali_ayir import ayir, govde_bas
M = '/home/claude/kktc-mevzuat-botu/veri/mahkemeler/'
R = '/home/claude/kktc-mevzuat-botu/'
def oku(p): return json.load(open(p))
dz = {str(y['p']): y for y in oku('app/pub/tum-dizin.json')['yasalar']}
kayit = oku(M + 'yasa-kayit.json'); lo = oku(M + 'yasa-lo-kayit.json')
neden = collections.Counter(); ornek = collections.defaultdict(list)
for pk, y in dz.items():
    if y.get('tz') or y.get('y') != 'parca' or not pk.isdigit(): continue
    k = kayit.get(pk, {}); l = lo.get(pk, {})
    if str(y.get('o')) == 'True': neden['ocr'] += 1; continue
    yol = l.get('metin_dosyasi') if y.get('k') == 'libreoffice' else k.get('metin_dosyasi')
    if not yol or not os.path.exists(R + yol): neden['dosya yok'] += 1; continue
    metin = open(R + yol, encoding='utf-8').read().replace('\r', '').replace('\f', '\n').replace('\xa0', ' ')
    b = govde_bas(metin); ms = ayir(metin, b)
    kapsam = sum(len(m['metin']) for m in ms) / max(1, len(metin) - b)
    nums = [int(re.match(r'\d+', m['no']).group()) for m in ms]
    bosluk = (max(nums) - len(set(nums))) / max(nums) if nums else 1
    enb = max((len(m['metin']) for m in ms), default=0)
    if len(ms) < 3: n = 'az madde'
    elif kapsam <= .55: n = 'kapsam düşük'
    elif bosluk >= .25: n = 'boşluk'
    elif enb > 30000 and enb > .35 * (len(metin) - b): n = 'dev madde'
    else: n = 'geçerdi'
    neden[n] += 1; ornek[n].append((y['n'], y['a'][:50], len(ms), round(kapsam, 2), round(bosluk, 2), b, y.get('k')))
print(neden)
for n, L in ornek.items():
    print('##', n); [print('  ', x) for x in L[:12]]
