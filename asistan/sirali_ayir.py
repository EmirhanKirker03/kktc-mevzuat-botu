"""Madde numaralarını sırayla izleyerek yasa metnini maddelere ayırır (LibreOffice düz metin çıktısı için).

Word dosyalarındaki otomatik numaralar LibreOffice'in metin çıktısında korunur. Bu ayırıcı
metindeki "N." biçimindeki numaraları sırayla kabul eder: beklenen numara, birkaç numara atlama
(kaldırılmış maddeler) veya aynı numaranın harfli eki (17A). Kelimeler değiştirilmez; yalnızca
kenar notları (ör. "4.20/2014" = 20/2014 sayılı yasanın 4. maddesiyle değişik) metinden ayrılıp
kenar_notu olarak saklanır.
"""
import re

NOT_RE = re.compile(r'(?<![\w/])\d{1,2}(?:\(\d+\))?\.\s?(?:\(\d+\))?\s?(\d{1,3}/\d{4})(?!\s*sayılı)(?![\d/])')
NOT2_RE = re.compile(r'(?<![\w/])(?:Cetvel\s*\d+\s*\([a-zç]\)\s*)?(\d{1,3}/(?:19|20)\d{2})(?=\s*$)', re.M)
BASLIK_DISI = re.compile(r'^(?:[IVX]+\.?\s*KISIM|.*\bKISIM\b|.*\bBölüm\b|.*\bBÖLÜM\b|BİRİNCİ|İKİNCİ|ÜÇÜNCÜ)', re.I)
NUM_RE = re.compile(r'(?:(?<=\n)|(?<=\t)|(?<=  )|(?<=[^\W\d]\s))[ \t]*\*?((?:\d|l(?=[\dl]*\.)){1,3})(?: ?([A-Z]))?\.\+?(?![ \t]*(?i:madde|fıkra|bent|bend|ve\b|veya\b|ila\b|ile\b|sayılı))(?:(?=[ \t]+(?!\d{1,3}/\d{2,4})\S|[ \t]*\n|\()|(?<=\n\d\.)(?=[A-ZÇĞİÖŞÜ“"])|(?<=\n\d\d\.)(?=[A-ZÇĞİÖŞÜ“"])|(?<=\n\d\d\d\.)(?=[A-ZÇĞİÖŞÜ“"])|(?<=\n\d\d[A-Z]\.)(?=[A-ZÇĞİÖŞÜ“"]))')
CETVEL_RE = re.compile(r'\n\s*(?:BİRİNCİ|İKİNCİ|ÜÇÜNCÜ)?\s*CETVEL\b|\n\s*CETVEL(?:LER)?\s*\n')


NOTSATIR = re.compile(r'^(?:\d{1,2}(?:\(\d+\))?[.,]\s?)?(?:\(\d+\)\s?)?\d{1,3}/\d{2,4}\.?$|^Bölüm\s*\d+\.?$|^\[[^\]]*\]$|^\d{1,3}/\d{2,4}(?:\s+\d{1,3}/\d{2,4})+$|^\d{1,2}\.\(\d+\)$|^\d{1,2}\.$')


def _baslik_bul(text, p, alt_sinir):
    """Numaranın hemen önündeki kenar başlığı satırlarını bulur: (başlık, başlığın başladığı konum).
    Kenar notu satırları (ör. "2.32/2026", "Bölüm 252") ve kısım/bölüm başlıkları atlanır ama başlığa katılmaz."""
    satir_bas = text.rfind('\n', 0, p) + 1
    ayni = text[satir_bas:p].strip()
    parcalar, bas = [], p
    if ayni and not NOTSATIR.match(NOT_RE.sub('', ayni).strip() or '1/1111'):
        parcalar.append(ayni); bas = satir_bas + (len(text[satir_bas:p]) - len(text[satir_bas:p].lstrip()))
    i, dolu = satir_bas, 0
    while i > alt_sinir and dolu < 6:
        onceki_bas = text.rfind('\n', 0, i - 1) + 1
        if onceki_bas < alt_sinir: break
        s = text[onceki_bas:i - 1].strip(); i = onceki_bas
        if not s:
            if parcalar and dolu >= 1 and not text[onceki_bas - 1:onceki_bas] == '\n': pass
            continue
        dolu += 1
        sn = NOT_RE.sub('', s); sn = NOT2_RE.sub('', sn).strip()
        if not sn or NOTSATIR.match(sn) or NOTSATIR.match(s): continue
        buyuk = len(sn) > 8 and not re.search(r'[a-zçğıöşü]', sn)
        if (BASLIK_DISI.match(sn) and len(sn) < 120) or buyuk:
            if len(parcalar) >= 2 and not buyuk: parcalar.pop(0); bas = text.find(parcalar[0], bas) if parcalar else p
            if parcalar: break
            continue
        ilk = not parcalar
        nokta_ok = ilk and sn.endswith('.') and len(sn) < 100 and ';' not in sn and not sn.startswith('(')
        if len(sn) > 200 or (re.search(r'[.;:,]$', sn) and not re.search(r'v\.s\.?$|vs\.$', sn) and not nokta_ok) or sn.startswith('(') or (not ilk and len(sn) > 110):
            break
        parcalar.insert(0, sn); bas = onceki_bas
    if len(parcalar) == 1 and parcalar[0][:1].islower(): parcalar, bas = [], p
    b = ' '.join(parcalar)
    b = NOT_RE.sub(' ', b); b = NOT2_RE.sub(' ', b)
    b = re.sub(r'(\w)- ?(?=[a-zçğıöşü])', r'\1', b)
    return re.sub(r'\s+', ' ', b).strip(' .\t'), bas


def ayir(text, bas_konum=0, son=None, en_fazla_atlama=4):
    text = text.replace('\r', '').replace('\f', '\n').replace('\xa0', ' ')
    son = len(text) if son is None else son
    adaylar = [(m.start(1), m.end(), int(m.group(1).replace('l', '1')), m.group(2) or '') for m in NUM_RE.finditer(text, bas_konum, son)]
    kabul, beklenen, son_no = [], 1, None
    for s, e, n, h in adaylar:
        if h:
            if son_no and n == son_no[0] and (h > son_no[1]): kabul.append((s, e, f'{n}{h}')); son_no = (n, h)
            continue
        if beklenen <= n <= beklenen + en_fazla_atlama:
            kabul.append((s, e, str(n))); beklenen = n + 1; son_no = (n, '')
    maddeler = []
    for i, (s, e, no) in enumerate(kabul):
        alt = kabul[i - 1][1] if i else bas_konum
        baslik, _ = _baslik_bul(text, s, alt)
        bit = son
        if i + 1 < len(kabul):
            _, bit = _baslik_bul(text, kabul[i + 1][0], e)
        else:
            m = CETVEL_RE.search(text, e, son)
            if m: bit = m.start()
        g = text[e:bit]
        notlar = sorted(set(NOT_RE.findall(g) + NOT2_RE.findall(g)))
        g = NOT_RE.sub(' ', g); g = NOT2_RE.sub(' ', g)
        # sondaki kısım/bölüm başlıklarını at
        satirlar = g.rstrip().split('\n')
        while satirlar and (not satirlar[-1].strip() or BASLIK_DISI.match(satirlar[-1].strip()) and len(satirlar[-1].strip()) < 120):
            satirlar.pop()
        g = '\n'.join(satirlar)
        g = re.sub(r'[ \t]+', ' ', g); g = re.sub(r'\s*\n\s*', '\n', g).strip()
        kaldirildi = bool(re.match(r'^[^\n]{0,120}(?:yürürlükten kaldırıl|kaldırılmıştır|iptal edilmiştir)', g)) and len(g) < 200
        maddeler.append({'no': no, 'baslik': baslik, 'metin': g, 'kenar_notu': notlar, 'kaldirildi': kaldirildi, '_konum': s})
    return maddeler


def govde_bas(text):
    """Yasanın asıl metninin başladığı yer: "Bu Yasa ... olarak isimlendirilir" cümlesinden hemen önceki "1." numarası."""
    text = text.replace('\r', '').replace('\f', '\n').replace('\xa0', ' ')
    m = re.search(r'Bu (?:Yasa|Tüzük|Yönetmelik|Kural|Kanun)[^\n]{0,120}?(?:isimlendiril|anıl|adlandırıl|denir|olarak an)', text)
    if not m: return 0
    pencere = text[max(0, m.start() - 200):m.start()]
    k = [x.start() for x in re.finditer(r'(?<![\d/])[1l]\.', pencere)]
    return max(0, m.start() - 200) + k[-1] - 1 if k else m.start()
