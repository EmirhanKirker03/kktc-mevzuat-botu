"""Yayın verisinin kalite sınırları (her derlemeden sonra çalıştırılır):
boş madde yok, dizin ↔ paket tutarlı, özel alan/denetim karakteri yok, çöp dizili bölüm ve okunamaz bölüm sınırın altında,
karar tarihleri geçerli."""
import json, glob, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bozuk_tara as bt
pub = sys.argv[1] if len(sys.argv) > 1 else 'app/pub'
bt.SUSP.discard('|')
dz = json.load(open(os.path.join(pub, 'tum-dizin.json')))['yasalar']
paket = {}
for f in glob.glob(os.path.join(pub, 'tum-*.json')):
    b = os.path.basename(f)[4:-5]
    if b != 'dizin': paket.update({k: (b, v) for k, v in json.load(open(f)).items()})
S = collections.Counter()
for x in dz:
    p = str(x['p'])
    if x.get('elle'): continue
    if p not in paket: S['dizinde var paket yok'] += 1; continue
    if str(x['b']) != paket[p][0]: S['paket numarası yanlış'] += 1
    if x['mc'] != len(paket[p][1]): S['madde sayısı tutmuyor'] += 1
for p, (b, ms) in paket.items():
    for m in ms:
        t = m.get('metin', '')
        if not t.strip(): S['boş madde'] += 1
        if re.search(r'[-�﻿]', t): S['özel alan/BOM'] += 1
        if re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', t): S['denetim karakteri'] += 1
        if bt.cop_diziler(t): S['çöp dizili bölüm'] += 1
        if m.get('okunamaz'): S['okunamaz bölüm'] += 1
S['pakette var dizinde yok'] = len(set(paket) - {str(x['p']) for x in dz})
kd = json.load(open(os.path.join(pub, 'karar-dizin.json')))['kararlar']
for k in kd:
    if k['tarih'] and not ('1950' <= k['tarih'] <= '2027'): S['karar tarihi geçersiz'] += 1
    if k['tarih'] and not re.fullmatch(r'\d{4}-\d{2}-\d{2}', k['tarih']): S['karar tarihi biçimi'] += 1
SINIR = {'dizinde var paket yok': 0, 'paket numarası yanlış': 0, 'madde sayısı tutmuyor': 0, 'boş madde': 0, 'özel alan/BOM': 0,
         'denetim karakteri': 0, 'pakette var dizinde yok': 0, 'karar tarihi geçersiz': 0, 'karar tarihi biçimi': 0,
         'çöp dizili bölüm': 120, 'okunamaz bölüm': 250}
kaldi = 0
for k, s in SINIR.items():
    ok = S[k] <= s; kaldi += not ok
    print(('GEÇTİ ' if ok else 'KALDI ') + f'{k}: {S[k]} (sınır {s})')
print(f'\nSONUÇ: {len(SINIR) - kaldi} geçti, {kaldi} kaldı')
sys.exit(1 if kaldi else 0)
