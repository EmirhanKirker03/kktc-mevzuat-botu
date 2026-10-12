"""Resmî Gazete sayılarının metninden hedef maddeleri (tüzük, emirname, yönetmelik, tebliğ) ayırır.
Girdi: rg_hedef_ham.json (Basımevi dizini: sayı, tarih, A.E. no, başlık), metin/<portal>_<yıl>_<sayı>.pdf.txt
Çıktı: rg_maddeler.json — her hedef için bulunan metin parçası ve eşleşme puanı. Metin değiştirilmez (yalnızca fazla boşluk)."""
import json, re, os, sys, collections
K = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/rg'
TR = str.maketrans('çğıöşüâîûÇĞİÖŞÜÂÎÛI', 'cgiosuaiuCGIOSUAIUI')
STOP = set('ve ile yasasi yasa tuzugu tuzuk degisiklik emirnamesi emirname yonetmeligi hakkinda iliskin bu ait'.split())
def toks(s): return {w[:6] for w in re.sub(r'[^a-z0-9 ]+', ' ', s.replace('İ', 'i').replace('I', 'ı').lower().translate(TR)).split() if len(w) > 2 and w not in STOP}
def buyuk(sat):
    h = [c for c in sat if c.isalpha()]
    return len(h) >= 6 and sum(1 for c in h if c.isupper()) / len(h) > 0.8
YAPAR = re.compile(r'aşağıdaki[^\n]{0,60}(?:\n[^\n]{0,30})?\b[Yy]apar\b|a[şs]a[ğg][ıi]daki\s+\S*\s*(?:T[üu]z[üu][ğg][üu]|Emirname\S*|Y[öo]netmeli\S*)\s+yapar', re.I)
def bolumler(t):
    t = re.sub(r'[ \t]+', ' ', t)
    sat = t.split('\n'); konum = [0]
    for x in sat: konum.append(konum[-1] + len(x) + 1)
    starts = []
    capalar = [m.start() for m in YAPAR.finditer(t)]
    # 'yapar' cümlesi okunamadıysa: '1. Bu Tüzük/Emirname ... olarak isimlendirilir' kısa isim maddesi
    for m in re.finditer(r'\b1\s*\.\s*Bu\s+(?:T[üu]z[üu]k|Emirname|Y[öo]netmelik|Tebli[ğg])\b', t):
        if not any(0 <= m.start() - c < 1500 for c in capalar): capalar.append(m.start())
    for c in sorted(capalar):
        m = re.match('', t[c:]); m_start = c
        i = t.count('\n', 0, m_start); j = i - 1; bas = i; bos = 0
        # başlık: yapar cümlesinin üstündeki büyük harfli satırlar (kenar notları araya girebilir)
        while j >= 0 and i - j < 40:
            s = sat[j].strip()
            if not s or s.startswith('[SAYFA'): j -= 1; continue
            if buyuk(s): bas = j; bos = 0
            else:
                bos += 1
                if bos > 12 and bas < i: break
            if re.match(r'^(Sayı|SAYI)\s*:', s) and bas < i: break
            j -= 1
        starts.append(konum[bas])
    starts = sorted(set(starts))
    return t, [(a, starts[k + 1] if k + 1 < len(starts) else len(t)) for k, a in enumerate(starts)]
def kirp(seg):
    m = re.search(r'\n\s*EK\s*IV\b|\n\s*EK\s*VI?\b\s*\n', seg[200:])
    return seg[:200 + m.start()] if m else seg
hedef = json.load(open(os.path.join(K, 'rg_hedef_ham.json'), encoding='utf-8'))
sayilar = collections.defaultdict(list)
for tur, l in hedef.items():
    for z in l: sayilar[re.sub(r'\?.*', '', z['u'])].append(dict(z, tur=tur))
out, ist = [], collections.Counter()
for u, its in sayilar.items():
    f = os.path.join(K, 'metin', re.sub(r'^/Portals/', '', u).replace('/', '_') + '.txt')
    if not os.path.exists(f): ist['metin yok'] += len(its); continue
    t, segs = bolumler(open(f, encoding='utf-8').read())
    puanlar = []
    for zi, z in enumerate(its):
        bt = toks(re.sub(r'^.*?YASASI\s*[-–]\s*', '', z['baslik'])) or toks(z['baslik'])
        for k, (a, b) in enumerate(segs):
            bas = toks(t[a:a + 900])
            ism = re.search(r'Bu\s+(?:T[üu]z[üu]k|Emirname|Y[öo]netmelik|Tebli[ğg])\s*,?([\s\S]{0,400}?)(?:isimlendiril|olarak an[ıi]l)', t[a:min(b, a + 4000)])
            if ism: bas |= toks(ism.group(1))
            puanlar.append((len(bt & bas) / max(1, len(bt)), zi, k))
    # açgözlü bire-bir atama: her bölüm en fazla bir maddeye, en yüksek puandan başlayarak (aynı sayıdaki benzer adlı emirnameler karışmasın)
    atandi, kullan = {}, set()
    for p, zi, k in sorted(puanlar, reverse=True):
        if p < 0.6 or zi in atandi or k in kullan: continue
        atandi[zi] = (k, p); kullan.add(k)
    for zi, z in enumerate(its):
        if zi in atandi:
            k, p = atandi[zi]; a, b = segs[k]
            ist['eşleşti'] += 1; ist[z['tur']] += 1
            out.append(dict(z, metin=kirp(t[a:b]).strip(), puan=round(p, 2)))
        else:
            ist['eşleşmedi'] += 1; out.append(dict(z, metin='', puan=round(max([q for q, zz, _ in puanlar if zz == zi] or [0]), 2)))
json.dump(out, open(os.path.join(K, 'rg_maddeler.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(dict(ist))
