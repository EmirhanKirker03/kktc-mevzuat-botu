"""onar.py'nin sözcük birleştirme adımı için sözlük: yalnızca temiz kaynaklardan (Yüksek Mahkeme'nin metin
tabanlı PDF/Word dosyaları ve mahkeme kararları; yazı tanıma ve Resmî Gazete taramaları hariç)."""
import json, glob, re, collections, sys, os
pub = sys.argv[1] if len(sys.argv) > 1 else 'app/pub'
def kucuk(w): return w.replace('I', 'ı').replace('İ', 'i').lower()
dz = json.load(open(os.path.join(pub, 'tum-dizin.json')))['yasalar']
temiz = {x['p'] for x in dz if not x.get('o') and not x.get('ks') and not x.get('en') and x.get('k') in ('pdf', 'libreoffice', 'docx', 'doc', 'elle', 'dogrudan-hmut')}
c = collections.Counter()
for f in glob.glob(os.path.join(pub, 'tum-*.json')):
    if 'dizin' in f: continue
    for k, ms in json.load(open(f)).items():
        if k in temiz:
            for m in ms:
                if len(re.findall(r'[a-zçöüı][ŞĞ][a-zçöüı]', m.get('metin', ''))) >= 2: continue  # yazı tipi hatalı metin
                c.update(kucuk(w) for w in re.findall(r'[A-Za-zÇĞİÖŞÜçğıöşüâîû]+', m.get('metin', '')))
for f in glob.glob(os.path.join(pub, 'karar-p*.json')):
    d = json.load(open(f)); it = d.values() if isinstance(d, dict) else d
    for m in it:
        for x in (m if isinstance(m, list) else [m]):
            if isinstance(x, dict): c.update(kucuk(w) for w in re.findall(r'[A-Za-zÇĞİÖŞÜçğıöşüâîû]+', x.get('metin') or x.get('text') or ''))
s = {w: n for w, n in c.items() if n >= 3 and len(w) >= 2}
json.dump(s, open('onar_sozluk.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(temiz), 'temiz metin;', len(s), 'sözcük')
