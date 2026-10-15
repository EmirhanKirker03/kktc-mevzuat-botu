"""Metin onarımı (anlamı değiştirmeden kodlama hatalarını düzeltir):
1) PDF yazı tipi kaydırması: bazı PDF'lerde harfler 29 kod geriye kaymış çıkar ('ELUWU' = 'birtr'); satır satır, Türkçe harf-çifti
   olasılığıyla karşılaştırılarak yalnızca açıkça daha olası olduğunda geri çevrilir.
2) Windows-1254/Latin-1 karışması: ý→ı, þ→ş, ð→ğ, Ý→İ, Þ→Ş, Ð→Ğ (metinde en az 5 kez geçiyorsa).
3) Çeviri aracı etiketleri: {0>İngilizce<}0{>Türkçe<0} → Türkçe.
4) Denetim karakterleri silinir; harf içermeyen anlamsız sembol dizileri çıkarılır, harfli çöp dizileri '[okunamayan kısım]' olur.
5) Symbol yazı tipi özel alan karakterleri (U+F0F5 = ı, U+F025 = %, ...) gerçek karşılıklarına çevrilir.
6) Harf harf bölünmüş sözcükler ('yap ı lacak', 'oldu ğ unu') temiz kaynaklardan kurulan sözlükle (onar_sozluk.json) birleştirilir;
   yalnızca birleşik hâli sözlükte olan ve parçalarından biri tek başına sözcük olmayan diziler birleştirilir.
7) Büyük harfli sözcüklerde yazı tanımanın küçük okuduğu i/l harfleri (ECZANESi, ALlŞ) büyük harfe çevrilir.
8) Hâlâ anlamsız harf dizisi olan satırlar (bilinmeyen kodlama, ters taranmış sayfa) '[okunamayan kısım]' olur."""
import re, math, json, os, collections
D = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(D, 'onar_model.json')
_m = None
def model():
    global _m
    if _m is None:
        _m = json.load(open(MODEL, encoding='utf-8')) if os.path.exists(MODEL) else {}
    return _m
def egit(metinler):
    c = collections.Counter(); u = collections.Counter()
    for t in metinler:
        t = ' ' + re.sub(r'\s+', ' ', t.lower()) + ' '
        for a, b in zip(t, t[1:]): c[a + b] += 1; u[a] += 1
    V = len(u) + 1
    m = {k: math.log((v + 1) / (u[k[0]] + V)) for k, v in c.items() if v >= 3}
    m['__taban'] = math.log(1 / (max(u.values()) + V))
    json.dump(m, open(MODEL, 'w', encoding='utf-8'), ensure_ascii=False)
def puan(s):
    m = model(); t = ' ' + re.sub(r'\s+', ' ', s.lower()) + ' '; tb = m.get('__taban', -12)
    if len(t) < 3: return 0
    return sum(m.get(a + b, tb) for a, b in zip(t, t[1:])) / (len(t) - 1)
# kanıt: Y|netici=Yönetici, T\x81rk=Türk, |lo\x81=ölçü, AltÕnda=Altında, çirket→Şirket, ¶inci=’inci
OZEL = {'Õ': 'ı', '\x81': 'ü', 'ú': 'ş', '÷': 'ğ', '|': 'ö', 'o': 'ç', 'ø': 'İ', 'ù': 'Ş', 'ö': 'Ç', '¶': '’', '³': '“', '\u0301': '”'}
SAYI = re.compile(r'\d{2,}(?:[.,/]\d+)+|\d+(?:[.,/]\d{2,})+|\d{5,}')  # gerçek sayılar (gümrük pozisyonu, oran, kod) kaydırılmaz
def kaydir(s):
    korunan = set()
    for m in SAYI.finditer(s): korunan.update(range(m.start(), m.end()))
    out = []
    for i, ch in enumerate(s):
        o = ord(ch)
        if i in korunan or ch == ' ': out.append(ch)
        elif 3 <= o <= 0x5D: out.append(chr(o + 29))
        elif ch in OZEL: out.append(OZEL[ch])
        else: out.append(ch)
    return ''.join(out)
def satir_onar(s):
    if not s.strip() or not re.search(r'[A-Z\\\]\[\x03-\x1f]{3}', s): return s, False
    k = kaydir(s)
    if puan(k) - puan(s) > 0.9 and re.search(r'[aeıioöuü]', k): return k, True
    return s, False
MOJ = str.maketrans({'ý': 'ı', 'þ': 'ş', 'ð': 'ğ', 'Ý': 'İ', 'Þ': 'Ş', 'Ð': 'Ğ'})
SUSP = set('ÛÃÐÞþð¼½¾ÆæØø×÷¤¦¨©«¬®¯±²³µ¶¸¹º»¿ÀÁÄÅÈÊËÌÍÏÑÒÓÔÕÙÚÝßàáäåèêëìíïñòóõùúýÿ~•\\{}^¡€ƒ„†‡ˆ‰Š‹ŒŽ˜™š›œžŸ')
def _supheli(w): return any(c in SUSP for c in w)
def cop_temizle(t):
    w = list(re.finditer(r'\S+', t)); parca = []; son = 0; i = 0; n = 0
    while i < len(w):
        j = i
        while j < len(w) and _supheli(w[j].group()): j += 1
        if j - i >= 4:
            dz = t[w[i].start():w[j - 1].end()]
            harf = sum(1 for c in dz if c.isalpha() and c not in SUSP)
            parca.append(t[son:w[i].start()]); parca.append('[okunamayan kısım]' if harf >= 6 else ''); son = w[j - 1].end(); n += 1
        i = max(j, i + 1)
    parca.append(t[son:])
    return ''.join(parca), n
# İkinci PDF hatası (Calibri glif kodlaması): küçük harfler Latin Genişletilmiş harflere, büyük harfler ASCII işaretlerine kaymış.
# Küçük harf eşlemesi örneklerle doğrulandı (ƚĂƌĂĨŦŶĚĂŶ = tarafından); büyük harfler sözlük oylamasıyla (≥10 oy) bulundu.
CAL_K = {'Ă':'a','ď':'b','Đ':'c','Ě':'d','Ğ':'e','Ĩ':'f','Ő':'g','Ś':'h','ŝ':'i','Ŭ':'k','ů':'l','ŵ':'m','Ŷ':'n','Ž':'o','Ɖ':'p','ƌ':'r','Ɛ':'s','ƚ':'t','Ƶ':'u','ǀ':'v','Ŧ':'ı','Ɣ':'ş','ƺ':'ü','Œ':'ğ','ĕ':'ç','Ƃ':'ö','ą':'â','Ǉ':'Y','ǌ':'Z','Ϭ':'0','ϭ':'1','Ϯ':'2','ϯ':'3','ϰ':'4','ϱ':'5','ϲ':'6','ϳ':'7','ϴ':'8','ϵ':'9','͘':'.','͕':',','ͬ':'/','͛':'’','Ϳ':')','͗':':','͞':'“','͟':'”','͍':'?'}
CAL_B = {'z':'Y','I':'H','T':'İ','5':'D','d':'T','D':'M','^':'S','<':'K','Y':'K',',':'H','.':'B','7':'İ','9':'E',"'":'G','&':'F','/':'C','>':'L','b':'Ş','m':'Ü','W':'P','E':'N','K':'O','Z':'R',';':'(','a':'M'}
CAL_IZ = set(CAL_K) - set('ǇǌϬϭϮϯϰϱϲϳϴϵ')
def calibri_onar(t):
    tum = sum(1 for c in t if c in 'ĂŝŶůƌŦƚĞ') >= 20 and sum(1 for c in t if c in CAL_IZ) >= 0.03 * len(t)
    def sozcuk(m):
        w = m.group().replace('LJ', 'y').replace('nj', '\x00').replace('ig', 'y')
        if not any(c in CAL_IZ for c in w): return m.group()  # kodlanmamış sözcük (ör. rakam) olduğu gibi
        if not tum:
            kod = sum(1 for c in w if c in CAL_IZ); belirgin = sum(1 for c in w if c in CAL_IZ and c != 'Ğ')
            if kod < 0.5 * len(w) or (belirgin < 2 and not (belirgin == 1 and kod == len(w) and len(w) >= 2)): return m.group()
        y = ''.join(CAL_K.get(c) or CAL_B.get(c) or c for c in w).replace('\x00', 'z')
        return re.sub(r'(?<=[a-zçğıöşü])[YZ]', lambda k: k.group().lower(), y)
    t2 = re.sub(r'\S+', sozcuk, t)
    if not tum:
        return t2, t2 != t  # metnin yalnızca bir bölümü bu yazı tipiyle kodlanmış: yalnızca belirgin kodlu sözcükler çevrilir
    t = t2
    return ''.join(CAL_K.get(c, c) if c in '͕ͬ͛͘Ϳ͗͟͞' else c for c in t), True
OZEL_ALAN = str.maketrans({'\uf0f5': 'ı', '\uf025': '%', '\uf05b': '[', '\uf05d': ']', '\uf0b7': '•'})
_soz = None
def sozluk():
    global _soz
    if _soz is None:
        p = os.path.join(D, 'onar_sozluk.json')
        _soz = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    return _soz
def kucuk(w): return w.replace('I', 'ı').replace('İ', 'i').lower()
TEK = set('ğşçöüıİĞŞÇÖÜ')
def _parca(w, s):
    f = s.get(kucuk(w), 0)
    return (len(w) == 1 and w in TEK) or (len(w) > 1 and f < 20 and not (len(w) >= 5 and f >= 3))
def sf_onar(t):
    """Üçüncü yazı tipi hatası: küçük ş/ğ büyük (AraŞtfrma, daĞarcfĞf), ı ise 'f' olarak çıkmış (Kfbrfs, taraffndan).
    Yalnızca bu belirti en az 5 kez görülen metinlerde; 'f' harfleri sözlükteki biçime göre tek tek seçilir."""
    if len(re.findall(r'[a-zçöüı][ŞĞ][a-zçöüı]', t)) < 5: return t, False
    t = re.sub(r'(?<=[a-zçğıöşü])[ŞĞ]', lambda m: m.group().lower().replace('ş', 'ş'), t)
    t = re.sub(r'[ŞĞ](?=[a-zçğıöşü]{2})(?<=[a-zçğıöşüA-Z][ŞĞ])', lambda m: m.group().lower(), t)
    soz = sozluk()
    def sozcuk(m):
        w = m.group()
        if 'f' not in w: return w
        yer = [i for i, c in enumerate(w) if c == 'f']
        if len(yer) > 6: return w
        f0 = soz.get(kucuk(w), 0); en, enf = w, 0
        for maske in range(1, 1 << len(yer)):
            l = list(w)
            for b, i in enumerate(yer):
                if maske >> b & 1: l[i] = 'ı'
            y = ''.join(l); f = soz.get(kucuk(y), 0)
            if f > enf: en, enf = y, f
        return en if enf >= 3 and enf > 3 * f0 else w
    return re.sub(r'[A-Za-zÇĞİÖŞÜçğıöşü]+', sozcuk, t), True
def birlestir(t):
    s = sozluk()
    if not s or len(re.findall(r'(?<!\S)[ğşçöüıİĞŞÇÖÜ](?!\S)', t)) < 3: return t, 0
    n = 0; sat = t.split('\n')
    for si, x in enumerate(sat):
        if ' ' not in x.strip(): continue
        tk = x.split(' '); out = []; i = 0
        while i < len(tk):
            en = None
            for L in (7, 6, 5, 4, 3, 2):
                if i + L > len(tk): continue
                g = tk[i:i + L]
                m0 = re.match(r'^([(\"“‘\']*)([A-Za-zÇĞİÖŞÜçğıöşüâîû]+)$', g[0])
                ml = re.match(r'^([A-Za-zÇĞİÖŞÜçğıöşüâîû]+)([.,;:)\"”’\'!?]*)$', g[-1])
                if not m0 or not ml or not all(re.fullmatch(r'[A-Za-zÇĞİÖŞÜçğıöşüâîû]+', w) for w in g[1:-1]): continue
                cores = [m0.group(2)] + g[1:-1] + [ml.group(1)]
                j = ''.join(cores); f = s.get(kucuk(j), 0)
                if len(j) >= 4 and f >= 5 and any(_parca(w, s) for w in cores):
                    p = 2 * L + math.log(f)  # uzun birleşme yeğlenir, ama çok seyrek sözcükler (herhangibir) yerine sık olanı
                    if en is None or p > en[0]: en = (p, L, m0.group(1) + j + ml.group(2))
            if en: out.append(en[2]); i += en[1]; n += 1
            else: out.append(tk[i]); i += 1
        sat[si] = ' '.join(out)
    return '\n'.join(sat), n
BUYUK = re.compile(r'(?<![\w])(?=[A-ZÇĞİÖŞÜil]*[il])[A-ZÇĞİÖŞÜil]{2,}(?![\w])')
def buyuk_duzelt(t):
    def f(m):
        w = m.group()
        if sum(1 for c in w if c.isupper()) < 3 or sum(1 for c in w if c in 'il') * 2 > len(w): return w
        w = w.replace('i', 'İ')
        if 'l' in w:  # yazı tanıma büyük I ya da L'yi l okumuş olabilir: sözlükte olan seçilir, yoksa dokunulmaz
            soz = sozluk()
            sec = max(('I', 'L'), key=lambda a: soz.get(kucuk(w.replace('l', a)), 0))
            if soz.get(kucuk(w.replace('l', sec)), 0): return w.replace('l', sec)
        return w
    t2 = BUYUK.sub(f, t)
    soz = sozluk()
    def g(m):  # büyük harfli sözcükte küçük okunmuş başka harfler (TURIzM, YASASı, DöVİZ): büyük hâli sözlükte varsa
        w = m.group(); b = sum(1 for c in w if c.isupper())
        if b < 0.6 * len(w) or b == len(w): return w
        if soz.get(kucuk(w), 0) >= 5: return w.replace('i', 'İ').replace('ı', 'I').upper()
        if soz.get(kucuk(w.replace('I', 'İ')), 0) >= 5: return w.replace('I', 'İ').replace('i', 'İ').replace('ı', 'I').upper()
        return w
    t2 = re.sub(r'(?<![\w])[A-Za-zÇĞİÖŞÜçğıöşü]{4,}(?![\w])', g, t2)
    return t2, t2 != t
GARIP_DEGIL = set('.,;:()/-%\'"’“”‘+*§°…·–—_=')
def cop_satir(t):
    """Onarımdan sonra hâlâ anlamsız olan satırlar (bilinmeyen yazı tipi kodlaması, ters taranmış sayfa)."""
    sat = t.split('\n'); n = 0
    for i, x in enumerate(sat):
        ns = [c for c in x if not c.isspace()]
        if len(ns) >= 6 and '[okunamayan kısım]' not in x:
            # harf ve rakamdan çok anlamsız işaret içeren satır (& 0 f E P & [ [ f f, P!$DM6MP#$>$6$=)
            gr = sum(1 for c in ns if not c.isalnum() and c not in GARIP_DEGIL)
            if gr >= 0.3 * len(ns) and sum(1 for c in ns if c.isdigit()) < 0.3 * len(ns) and not re.fullmatch(r'[\s._…·-]+', x):
                sat[i] = '[okunamayan kısım]'; n += 1; continue
        if len(ns) < 15: continue
        if sum(1 for c in ns if c.isalpha()) < 0.5 * len(ns): continue
        p = puan(re.sub(r'[\d.,/%-]+', ' ', x))
        if p > -6.0: continue
        ws = x.split()
        if x.count('|') >= 2 or len(set(ws)) * 2 <= len(ws): continue  # tablo satırı ya da yinelenen kısaltmalar (Bçvş. Bçvş.)
        tuhaf = sum(1 for w in ws if re.search(r'[A-Za-zÇĞİÖŞÜçğıöşü][\\^`\[\]{}<>@#$!|;~*+=?"\'][A-Za-zÇĞİÖŞÜçğıöşü]|[a-zçğıöşü][A-ZÇĞİÖŞÜ].*[a-zçğıöşü][A-ZÇĞİÖŞÜ]|[a-zçğıöşü]\d|\d[a-zçğıöşü]{2}', w)) / max(1, len(ws))
        if p < -7.5 or tuhaf >= 0.4:
            sat[i] = '[okunamayan kısım]'; n += 1
    # iki okunamayan satır arasındaki kısa artıklar (M, ", P, ~) da okunamayan kısma katılır
    soz = sozluk()
    def artik(x):
        y = x.strip()
        return y == '' or (len(y) <= 3 and not re.search(r'\d', y) and soz.get(kucuk(y), 0) < 3)
    i = 0
    while i < len(sat):
        if sat[i] == '[okunamayan kısım]':
            j = i + 1
            while j < len(sat) and artik(sat[j]): j += 1
            if j < len(sat) and sat[j] == '[okunamayan kısım]' and j > i + 1:
                del sat[i + 1:j + 1]; continue
        i += 1
    t = '\n'.join(sat)
    t = re.sub(r'\[okunamayan kısım\](?:\s*\[okunamayan kısım\])+', '[okunamayan kısım]', t)
    return t, n
def onar(t, sayac=None):
    if not t: return t
    sayac = sayac if sayac is not None else collections.Counter()
    t = re.sub(r'\{0>(.*?)<\}\d*\{>(.*?)<0\}', r'\2', t, flags=re.S)
    if re.search(r'[\uf000-\uf0ff]', t): t = t.translate(OZEL_ALAN); sayac['özel alan'] += 1
    t = re.sub(r'[\ufeff\u200b\u200e\u200f\u00ad]', '', t)  # görünmez karakterler (BOM, sıfır genişlikli boşluk, yumuşak tire)
    # kaydırmasız kalmış özel harfler (TESPøT EDøLEN, RAHATSIZLIöA): yalnızca büyük harfli sözcük içinde
    if len(re.findall(r'(?<=[A-ZÇĞİÖŞÜ])[øÕú÷]|[øÕú÷](?=[A-ZÇĞİÖŞÜ])', t)) >= 2:
        t = re.sub(r'\b[A-ZÇĞİÖŞÜøÕúù÷ö]{2,}\b', lambda m: m.group().translate(str.maketrans({'ø': 'İ', 'Õ': 'I', 'ú': 'Ş', 'ù': 'Ş', '÷': 'Ğ', 'ö': 'Ğ'})) if re.search(r'[A-Z]', m.group()) and re.search(r'[øÕú÷ö]', m.group()) else m.group(), t)
        sayac['büyük harf'] += 1
    if t.count('Õ') >= 3:  # Õ Türkçede yoktur: kaydırmasız özel harfler (OranlarÕnÕ, Yaú, øçin)
        t = t.translate(str.maketrans({'Õ': 'ı', 'ú': 'ş', '÷': 'ğ', 'ø': 'İ', 'ù': 'Ş'})); sayac['özel harf'] += 1
    t, c = calibri_onar(t)
    if c: sayac['calibri'] += 1
    if len(re.findall(r'[ýþðÝÞÐ]', t)) >= 5:
        ing = t.lower().count(' the ') + t.lower().count(' of ') > 2 * (t.lower().count(' ve ') + t.lower().count(' bir ') + 1)
        t = t.translate(str.maketrans({'ý': 'i', 'Ý': 'I'}) if ing else MOJ); sayac['1254'] += 1
    sat = t.split('\n'); deg = 0
    for i, s in enumerate(sat):
        y, d = satir_onar(s)
        if d: sat[i] = y; deg += 1
    if deg and deg >= 0.2 * sum(1 for x in sat if x.strip()):
        # metnin çoğu kaymışsa kalan satırlar sözcük sözcük değerlendirilir (kısa satırlar, rakamla karışık satırlar)
        for i, x in enumerate(sat):
            if not x.strip(): continue
            ws = re.split(r'(\s+)', x); yeni = []
            for w in ws:
                if not w.strip() or len(w) < 2: yeni.append(w); continue
                k = kaydir(w)
                yeni.append(k if puan(k) > puan(w) + 0.5 else w)
            y = ''.join(yeni)
            if y != x: sat[i] = y; deg += 1
    if deg: sayac['kaydırma satır'] += deg; sayac['kaydırma metin'] += 1
    t = '\n'.join(sat)
    t2 = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', ' ', t)
    if t2 != t: sayac['denetim'] += 1
    t, n = cop_temizle(t2)
    if n: sayac['çöp dizi'] += n
    t, d = sf_onar(t)
    if d: sayac['ş/ğ/f yazı tipi'] += 1
    t, n = birlestir(t)
    if n: sayac['birleştirilen sözcük'] += n; sayac['birleştirme metin'] += 1
    t, d = buyuk_duzelt(t)
    if d: sayac['büyük i/l'] += 1
    t, n = cop_satir(t)
    if n: sayac['çöp satır'] += n
    return t

OKUNAMAZ_NOT = '[Bu bölümün metni kaynak dosyada bozuk kodlandığı için okunamadı. Lütfen resmî metne bakın.]'
def _okunur_satir(x, soz):
    y = x.strip()
    if not y or y == '[okunamayan kısım]': return y == ''
    ws = re.findall(r'[A-Za-zÇĞİÖŞÜçğıöşüâîû]+', y)
    harf = sum(len(w) for w in ws)
    if harf == 0: return bool(re.fullmatch(r'[\d\s.,:;()/%-]+', y))
    if harf <= 3: return len(y) <= 4
    return sum(len(w) for w in ws if len(w) >= 3 and soz.get(kucuk(w), 0) >= 3) >= 0.5 * harf
def _okunamaz(t, puanli=True):
    t = t[:4000]; ns = [c for c in t if not c.isspace()]
    if len(ns) < 80: return False
    harf = sum(1 for c in ns if c.isalpha()) / len(ns)
    if puanli and harf > 0.5 and puan(re.sub(r'[\d.,/%-]+', ' ', t)) < -5.0: return True
    # okunur sözcük payı çok düşük, anlamsız işaret payı yüksek (bilinmeyen yazı tipi kodlaması)
    t2 = t.replace('[okunamayan kısım]', ' '); ns2 = [c for c in t2 if not c.isspace()]
    if len(ns2) < 150: return len(ns2) < 0.3 * len(ns) and t.count('[okunamayan kısım]') >= 3
    soz = sozluk(); iyi = sum(len(w) for w in re.findall(r'[A-Za-zÇĞİÖŞÜçğıöşüâîû]{2,}', t2) if soz.get(kucuk(w), 0) >= 3)
    garip = sum(1 for c in ns2 if not c.isalnum() and c not in GARIP_DEGIL)
    return iyi < 0.12 * len(ns2) and garip > 0.1 * len(ns2)
def okunamaz(t):
    """Onarımdan sonra hâlâ büyük ölçüde anlamsız olan metin (tablolar ve rakamlar hariç)."""
    return _okunamaz(t)
def okunamaz_bas(t):
    """Metin okunamıyorsa baştaki okunur satırları (Resmî Gazete başlığı, yürürlük maddesi gibi) döndürür; okunuyorsa None."""
    if not _okunamaz(t):
        sat = t.split('\n'); soz = sozluk(); k = 0
        while k < len(sat) and _okunur_satir(sat[k], soz): k += 1
        if k == 0 or k >= len(sat) or not _okunamaz('\n'.join(sat[k:]), False): return None
        return '\n'.join(sat[:k]).strip()
    sat = t.split('\n'); soz = sozluk(); k = 0
    while k < len(sat) and _okunur_satir(sat[k], soz): k += 1
    return '\n'.join(sat[:k]).strip()
