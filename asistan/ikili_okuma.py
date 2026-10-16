"""İkili okuma: Yüksek Mahkeme sisteminde yalnızca taranmış olan tüzüklerin yazı tanıma metni, aynı tüzüğün
Resmî Gazete'deki ikinci okumasıyla (Gazete PDF'inin metin katmanı ya da 2017 sonrası dijital metin) kelime kelime
hizalanır. İki okuma farklıysa sözlükte olan (temiz kaynaklardan kurulan onar_sozluk.json) kelime seçilir; 2017 ve
sonrası dijital Gazete metni esas alınır. Hiçbir kelime uydurulmaz: yalnızca iki kaynak okumadan biri seçilir.
Çıktı: ikili_okuma.json  {p: {madde_no: [eski_metin_md5, yeni_metin]}} — build_tum.py uygular."""
import json, re, os, sys, glob, hashlib, collections, difflib
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import onar
soz = onar.sozluk()
K = '/home/claude/rg'
o = [x for x in json.load(open(os.path.join(K, 'rg_dogrula.json'), encoding='utf-8')) if x.get('durum') == 'eşleşti']
yap = set(json.load(open(os.path.join(K, 'ocr_yapildi.json'))))
P = {}
for f in glob.glob(os.path.join(D, 'app/pub/tum-*.json')):
    if 'dizin' in f: continue
    P.update(json.load(open(f, encoding='utf-8')))
def cekirdek(w): return re.sub(r"^[^\wÇĞİÖŞÜçğıöşü]+|[^\wÇĞİÖŞÜçğıöşü]+$", '', w)
def frek(w):
    c = cekirdek(w)
    if not c: return 0
    if re.search(r'\d', c): return -1
    return soz.get(onar.kucuk(c), 0)
def norm(w): return onar.kucuk(cekirdek(w))
def bozuk(t):
    w = re.findall(r'\S+', t)
    return sum(1 for x in w if re.search(r'[~·•|\\{}<>^¡¿]|[a-zçğıöşü][A-ZÇĞİÖŞÜ]{2}|\d[a-zçğıöşü]{2,}\d', x)) / max(1, len(w))
out, ist = {}, collections.Counter()
for x in o:
    ms = P.get(str(x['p']))
    if not ms: continue
    yil = int(x['ae'].split('/')[1])
    rgt = onar.onar(x['metin'])
    dijital = False  # 2017 sonrası Gazete PDF'lerinin de çoğu taranmış metin katmanı: hiçbir okuma esas alınmaz
    # YM kelimeleri (madde, başlangıç, bitiş) konumlarıyla
    yt = []
    for mi, m in enumerate(ms):
        if m.get('sd') or m.get('okunamaz'): continue
        for mm in re.finditer(r'\S+', m['metin']): yt.append((mi, mm.start(), mm.end(), mm.group()))
    rt = re.findall(r'\S+', rgt)
    if not yt or not rt or len(yt) > 30000 or len(rt) > 30000: ist['atlandı (boyut)'] += 1; continue
    a, b = [norm(w[3]) for w in yt], [norm(w) for w in rt]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    esit = sum(bl.size for bl in sm.get_matching_blocks())
    uyum = esit / max(1, len(a))
    if uyum < 0.6: ist['uyumsuz (farklı metin olabilir)'] += 1; continue
    degis = collections.defaultdict(list)  # madde -> [(bas, son, yeni)]
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op != 'replace' or i2 - i1 > 3 or j2 - j1 > 3: continue
        Y, R = yt[i1:i2], rt[j1:j2]
        if len({w[0] for w in Y}) > 1: continue  # madde sınırını aşan değişiklik yok
        if any(re.search(r'\d', w[3]) for w in Y) or any(re.search(r'\d', w) for w in R): continue  # sayılarda seçim yapılmaz
        if not all(cekirdek(w[3]) and re.search(r'[A-Za-zÇĞİÖŞÜçğıöşü]', w[3]) for w in Y): continue
        if not all(re.fullmatch(r"[(\"“‘']*[A-Za-zÇĞİÖŞÜçğıöşüâîûÂÎÛ]+(?:['’][A-Za-zçğıöşü]+)?[.,;:)\"”’']*", w) for w in R): continue
        fy = [frek(w[3]) for w in Y]; fr = [frek(w) for w in R]
        if re.sub(r'[âîû]', lambda m: 'aiu'['âîû'.index(m.group())], ''.join(w[3] for w in Y)) == ''.join(R): continue  # yalnızca şapka farkı
        # Gazete okuması temiz sözcük(ler), YM okuması sözlükte olmayan bozuk sözcük: Gazete'ninki seçilir
        if len(R) > len(Y) or any(len(cekirdek(w)) < 3 for w in R) or any(len(cekirdek(w[3])) < 3 for w in Y): continue
        if any(re.fullmatch(r'[IVXLC]+', cekirdek(w[3])) for w in Y) or any(re.search(r'[ıi]{2}|ıi|iı', cekirdek(w).lower()) for w in R): continue
        son = lambda w: re.search(r"[^\wÇĞİÖŞÜçğıöşüâîû]*$", w).group()
        if son(R[-1]) != son(Y[-1][3]): continue  # noktalama değiştirilmez
        if any(re.search(r'[a-zçğıöşü][A-ZÇĞİÖŞÜ]', cekirdek(w)) for w in R): continue  # karışık büyük/küçük harf (gUn)
        sec = min(fr) >= 30 and min(fy) < 3
        # iki okuma birbirine benzemeli (aynı sözcüğün iki okuması); benzemiyorsa hizalama kaymıştır
        if sec and difflib.SequenceMatcher(None, norm(' '.join(w[3] for w in Y)).replace(' ', ''), norm(' '.join(R)).replace(' ', '')).ratio() < 0.6: sec = False
        if sec and ' '.join(w[3] for w in Y) != ' '.join(R):
            degis[Y[0][0]].append((Y[0][1], Y[-1][2], ' '.join(R)))
            ist['değişen kelime grubu'] += 1
    if not degis: ist['farksız'] += 1; continue
    ist['düzeltilen tüzük'] += 1; ist['dijital esas' if dijital else 'iki taranmış okuma'] += 1
    d = {}
    for mi, ds in degis.items():
        t = ms[mi]['metin']
        for bas, son, yeni in sorted(ds, reverse=True): t = t[:bas] + yeni + t[son:]
        d[str(ms[mi]['no'])] = [hashlib.md5(ms[mi]['metin'].encode()).hexdigest(), t]
    out[str(x['p'])] = {'rg': x['ae'], 'u': x['u'], 'dijital': dijital, 'uyum': round(uyum, 3), 'm': d}
json.dump(out, open(os.path.join(D, 'ikili_okuma.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(dict(ist))
