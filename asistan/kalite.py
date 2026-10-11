# madde ayırma kalitesi: 1. madde kısa isim mi, boş madde ağırlığı, eksik numara, önce/sonra karşılaştırması
import json, re, sys
def olc(dz_yol, pub):
    d = json.load(open(dz_yol))['yasalar']; cache = {}; st = {'madde': 0, 'kisa': 0, 'bos': 0, 'parca': 0}; tur = {}
    for y in d:
        if y.get('k') == 'elle' or str(y['p']) == 'T7384': continue
        if y.get('y') == 'parca': st['parca'] += 1; tur[str(y['p'])] = 'parca'; continue
        if y.get('y') != 'madde': continue
        if y['b'] not in cache: cache[y['b']] = json.load(open(f"{pub}/tum-{y['b']}.json"))
        M = [m for m in cache[y['b']][str(y['p'])] if not m.get('sd')]
        if not M: continue
        st['madde'] += 1; tur[str(y['p'])] = 'madde'
        if re.search(r'isimlendiril|olarak anıl|adlandırıl|Kısa [İi]sim|cited as|may be cited|olarak bilinir', M[0]['metin'][:400] + ' ' + (M[0]['baslik'] or ''), re.I): st['kisa'] += 1
        k = sum(1 for m in M if len(m['metin'].strip()) < 25 and not m.get('kaldirildi'))
        if k >= 3 and k / len(M) > 0.25: st['bos'] += 1
    return st, tur
a, ta = olc(sys.argv[1], sys.argv[2]); b, tb = olc(sys.argv[3], sys.argv[4])
print('önce', a, '1.madde kısa isim %', round(100 * a['kisa'] / a['madde'], 1)); print('sonra', b, '1.madde kısa isim %', round(100 * b['kisa'] / b['madde'], 1))
print('parçadan maddeye', sum(1 for k, v in tb.items() if v == 'madde' and ta.get(k) == 'parca'), '| maddeden parçaya', sum(1 for k, v in tb.items() if v == 'parca' and ta.get(k) == 'madde'))
