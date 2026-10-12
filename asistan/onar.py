"""Metin onarımı (anlamı değiştirmeden kodlama hatalarını düzeltir):
1) PDF yazı tipi kaydırması: bazı PDF'lerde harfler 29 kod geriye kaymış çıkar ('ELUWU' = 'birtr'); satır satır, Türkçe harf-çifti
   olasılığıyla karşılaştırılarak yalnızca açıkça daha olası olduğunda geri çevrilir.
2) Windows-1254/Latin-1 karışması: ý→ı, þ→ş, ð→ğ, Ý→İ, Þ→Ş, Ð→Ğ (metinde en az 5 kez geçiyorsa).
3) Çeviri aracı etiketleri: {0>İngilizce<}0{>Türkçe<0} → Türkçe.
4) Denetim karakterleri silinir; harf içermeyen anlamsız sembol dizileri çıkarılır, harfli çöp dizileri '[okunamayan kısım]' olur."""
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
    if sum(1 for c in t if c in 'ĂŝŶůƌŦƚĞ') < 20 or sum(1 for c in t if c in CAL_IZ) < 0.03 * len(t): return t, False
    def sozcuk(m):
        w = m.group().replace('LJ', 'y').replace('nj', '\x00').replace('ig', 'y')
        if not any(c in CAL_IZ for c in w): return m.group()  # kodlanmamış sözcük (ör. rakam) olduğu gibi
        return ''.join(CAL_K.get(c) or CAL_B.get(c) or c for c in w).replace('\x00', 'z')
    t = re.sub(r'\S+', sozcuk, t)
    return ''.join(CAL_K.get(c, c) if c in '͕ͬ͛͘Ϳ͗͟͞' else c for c in t), True
def onar(t, sayac=None):
    if not t: return t
    sayac = sayac if sayac is not None else collections.Counter()
    t = re.sub(r'\{0>(.*?)<\}\d*\{>(.*?)<0\}', r'\2', t, flags=re.S)
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
    return t

OKUNAMAZ_NOT = '[Bu bölümün metni kaynak dosyada bozuk kodlandığı için okunamadı. Lütfen resmî metne bakın.]'
def okunamaz(t):
    """Onarımdan sonra hâlâ anlamsız harf dizilerinden oluşan metin (tablolar ve rakamlar hariç)."""
    t = t[:4000]; ns = [c for c in t if not c.isspace()]
    if len(ns) < 80: return False
    harf = sum(1 for c in ns if c.isalpha()) / len(ns)
    return harf > 0.5 and puan(re.sub(r'[\d.,/%-]+', ' ', t)) < -5.0
