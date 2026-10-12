"""Metinlerde bozuk karakter dizilerini (Word nesnesi/kodlama artığı, anlamsız yazı tanıma çöpü) bulur.
Bir 'çöp dizisi': art arda en az 4 sözcük, her birinde Türkçe/İngilizce metinde olmayan karakter (Û, Ã, ¼, ~, •, | ...) bulunan."""
import json, re, glob, os, sys, collections
SUSP = set('ÛÃÐÞþð¼½¾ÆæØø×÷¤¦¨©«¬®¯±²³µ¶¸¹º»¿ÀÁÄÅÈÊËÌÍÏÑÒÓÔÕÙÚÝßàáäåèêëìíïñòóõùúýÿ~•|\\{}^¡€ƒ„†‡ˆ‰Š‹ŒŽ‘’“”–—˜™š›œžŸ\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f')
SUSP -= set('‘’“”–—')  # tırnak ve tireler olağan
def supheli(w): return any(c in SUSP for c in w) or (len(w) >= 4 and sum(1 for c in w if c.isupper()) >= 3 and any(c.islower() for c in w[1:]) and not re.fullmatch(r'[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)+', w))
def cop_diziler(t, en_az=4):
    out = []; w = list(re.finditer(r'\S+', t)); i = 0
    while i < len(w):
        j = i
        while j < len(w) and supheli(w[j].group()): j += 1
        if j - i >= en_az: out.append((w[i].start(), w[j - 1].end()))
        i = max(j, i + 1)
    return out
if __name__ == '__main__':
    pub = sys.argv[1]
    say = collections.Counter(); ornek = collections.defaultdict(list)
    for f in sorted(glob.glob(os.path.join(pub, 'tum-*.json'))) + sorted(glob.glob(os.path.join(pub, 'karar-p*.json'))):
        if f.endswith('tum-dizin.json'): continue
        d = json.load(open(f, encoding='utf-8'))
        it = d.items() if isinstance(d, dict) else enumerate(d)
        for k, v in it:
            ms = v if isinstance(v, list) else [v]
            for m in ms:
                t = m.get('metin') or m.get('text') or '' if isinstance(m, dict) else str(m)
                c = cop_diziler(t)
                if c:
                    tur = 'karar' if 'karar-p' in f else ('tüzük/RG' if str(k).startswith(('T', 'R')) else 'YGK' if str(k).startswith('G') else 'yasa')
                    say[tur] += 1; say[tur + ' dizi'] += len(c)
                    if len(ornek[tur]) < 4: ornek[tur].append((k, m.get('no') if isinstance(m, dict) else '', t[c[0][0]:c[0][1]][:120]))
    print(dict(say))
    for t, l in ornek.items():
        for x in l: print(t, x)
