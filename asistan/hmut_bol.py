# HMUT (Hukuk Muhakemeleri Usulü Tüzüğü, birleştirilmiş) metnini "Emir N n.M" birimlerine ve formlara böler.
# Kaynak: resmî .doc dosyasının doğrudan metin çıkarımı (sekmelerle ayrılmış: kenar notu <TAB> nizam no <TAB> metin).
# LibreOffice çıktısı bu belgede bazı Emir başlıklarını (38, 39, 49, 52-59) düşürdüğü için kullanılmaz.
# build_tum.py'den sonra çalıştırılır; tum-<b>.json içindeki T7384 kaydını ve tum-dizin.json girdisini yeniler.
import json, re, sys
PUB = 'app/pub/'
KOD = 'T7384'
KAYNAK = '/home/claude/kktc-mevzuat-botu/veri/mahkemeler/tuzukler/7384_HMUT-Bir.yeni.doc.txt'
dz = json.load(open(PUB + 'tum-dizin.json'))
y = next(x for x in dz['yasalar'] if str(x['p']) == KOD)
paket = json.load(open(PUB + f"tum-{y['b']}.json"))
METIN = open(KAYNAK, encoding='utf-8').read().replace('\r', '')
toplam_once = len(re.sub(r'\s+', '', METIN))

BIR = {'BİRİNCİ':1,'İKİNCİ':2,'ÜÇÜNCÜ':3,'DÖRDÜNCÜ':4,'BEŞİNCİ':5,'ALTINCI':6,'YEDİNCİ':7,'SEKİZİNCİ':8,'DOKUZUNCU':9}
ONLUK_SIRA = {'ONUNCU':10,'YİRMİNCİ':20,'OTUZUNCU':30,'KIRKINCI':40,'ELLİNCİ':50,'ALTMIŞINCI':60}
ONLUK = {'ON':10,'YİRMİ':20,'OTUZ':30,'KIRK':40,'ELLİ':50,'ALTMIŞ':60}
def emir_no(baslik):
    b = re.sub(r'\s+', ' ', baslik.replace('*', '')).strip()
    m = re.match(r'^EMİR\s+(\d+\s?\(?[A-Z]?\)?)$', b)
    if m: return m.group(1).replace(' ', '')
    if not b.endswith('EMİR'): return None
    w = b[:-len('EMİR')].strip()
    for k in ONLUK:
        if w.startswith(k) and w != k and not w.startswith(k + ' ') and w[len(k):] in BIR: w = k + ' ' + w[len(k):]
    if w in BIR: return str(BIR[w])
    if w in ONLUK_SIRA: return str(ONLUK_SIRA[w])
    p = w.split()
    if len(p) == 2 and p[0] in ONLUK and p[1] in BIR: return str(ONLUK[p[0]] + BIR[p[1]])
    return None

KENAR_RE = re.compile(r'^(R\.?\s?G\.?.*|RG\..*|A\.\s?E\.?.*|AE\.?\s?\d.*|Ek\.?\s?I+.*|EK\.?\s?I+.*|[IK]\.?\s*\d+\s*,.*|[IK]\.\s?\d+.*|K\.B\..*|E\.?\s*\d+\s*,.*|E\.\s?\d+.*|\(\d{4}\)|\d{1,2}[./]\d{1,2}[./]\d{2,4}.*|\d+,\s*Cilt.*|\d+-\d+|\d{1,3},\s?\d{1,3}.*|\d{2,3}|Düzeltme|Kısa İsim)$')
NIZ_RE = re.compile(r'^(\d{1,2}[A-Z]?)\s?\.$')
def tr_cumle(s):
    k = s.replace('I', 'ı').replace('İ', 'i').lower()
    k = (('İ' if k[0] == 'i' else 'I' if k[0] == 'ı' else k[0].upper()) + k[1:]) if k else ''
    for a, b in [(' türk ', ' Türk '), (' xıı ', ' XII '), ('hukuk muhakemeleri usulü yasası', 'Hukuk Muhakemeleri Usulü Yasası'), ('fasıl 6', 'Fasıl 6')]: k = k.replace(a, b)
    return k.strip(' .')

satirlar = METIN.split('\n')
ilk = next(i for i, s in enumerate(satirlar) if s.strip() == 'BİRİNCİ EMİR')
FORM_BAS = next(i for i, s in enumerate(satirlar) if s.strip() == "FORM'LAR")
birimler = []
def ekle(no, baslik, govde, notlar):
    t = re.sub(r'\n{3,}', '\n\n', '\n'.join(g.rstrip() for g in govde)).strip()
    if t: birimler.append({'no': no, 'baslik': baslik, 'metin': t, 'kenar': ' · '.join(dict.fromkeys(n for n in notlar if n))})

ekle('İçindekiler', 'Tüzüğün içindekiler listesi', [s.replace('\t', ' ') for s in satirlar[:ilk]], [])

def ayir(satir):
    """(kenar notları, nizam no veya None, metin) — sekmeli satırı çözer"""
    seg = [s.strip() for s in satir.split('\t')]
    for i, s in enumerate(seg):
        m_ = NIZ_RE.match(s) or (re.fullmatch(r'(\d{1,2})', s) if i > 0 or len(seg) > 1 else None)
        if m_ and any(x for x in seg[i + 1:]) and all(KENAR_RE.match(x) or not x for x in seg[:i]):
            return [x for x in seg[:i] if x], m_.group(1), ' '.join(x for x in seg[i + 1:] if x)
    dolu = [x for x in seg if x]
    if len(dolu) >= 2 and KENAR_RE.match(dolu[0]) and seg[0] == dolu[0]:
        return [dolu[0]], None, ' '.join(dolu[1:])
    if len(dolu) == 1 and KENAR_RE.match(dolu[0]): return [dolu[0]], None, ''
    return [], None, ' '.join(dolu)

def baslik_mi(satir):
    for s in [re.sub(r'\s+', ' ', x.strip()) for x in satir.split('\t') if x.strip()]:
        if re.fullmatch(r'((?:[A-ZÇĞİÖŞÜ]+ ?){1,3}EMİR|EMİR\s+\d+\s?\(?[A-Z]?\)?)\*?', s) and emir_no(s): return emir_no(s)
    return None

basliklar = [(i, baslik_mi(satirlar[i])) for i in range(ilk, FORM_BAS) if baslik_mi(satirlar[i])]
for k, (i, eno) in enumerate(basliklar):
    son = basliklar[k + 1][0] if k + 1 < len(basliklar) else FORM_BAS
    j = i + 1; ad = []
    while j < son:
        t = satirlar[j].strip()
        if not t: j += 1; continue
        kn, nz, tx = ayir(satirlar[j])
        if nz is None and not kn and '\t' not in satirlar[j].strip() and t == t.upper() and len(ad) < 3 and not re.match(r'^\(|^\d{1,2}\.?$', t): ad.append(t); j += 1; continue
        break
    ebaslik = tr_cumle(re.sub(r'\s+', ' ', ' '.join(ad))) if ad else ''
    nizam = None; beklenen = 1; govde = []; notlar = []
    def kapat():
        ekle(f'Emir {eno}' + (f' n.{nizam}' if nizam else ''), ebaslik, govde, notlar)
    for s in satirlar[j:son]:
        kn, nz, tx = ayir(s)
        if nz:
            sayi = int(re.match(r'\d+', nz).group(0)); simdiki = int(re.match(r'\d+', nizam).group(0)) if nizam else 0
            if (sayi in (beklenen, beklenen + 1) and sayi > simdiki) or (nizam and sayi == simdiki and nz != nizam and re.search(r'[A-Z]$', nz)):
                kapat(); nizam = nz; beklenen = sayi + 1; govde = [tx]; notlar = list(kn); continue
            tx = nz + '. ' + tx  # sıradışı numara: metnin parçası
        notlar += kn
        govde.append(tx)
    kapat()

# yapışık nizamlar: kenar notu aynı satırda olduğunda ("490. 17. Tek taraflı ...") nizam bir öncekinin içinde kalır; burada ayrılır
def nizam_no(no):
    m = re.match(r'Emir (\S+?)(?: n\.(\d+)[A-Z]?)?$', no); return (m.group(1), int(m.group(2)) if m.group(2) else 0) if m else (None, None)
ayrilan = []
degisti = True
while degisti:
    degisti = False
    gruplar = {}
    for i, b in enumerate(birimler):
        e, n = nizam_no(b['no'])
        if e is not None: gruplar.setdefault(e, []).append((n, i))
    for e, liste in gruplar.items():
        varolan = {n for n, _ in liste if n}
        if not varolan: continue
        for eksik_n in [k for k in range(1, max(varolan) + 1) if k not in varolan]:
            onceki = [(n, i) for n, i in liste if n < eksik_n]
            if not onceki: continue
            n0, i0 = max(onceki)
            b = birimler[i0]
            m = re.search(r'(?m)^([^\n]{0,30}?\s)?%d\s?\.\s+(?=[A-ZÇĞİÖŞÜ(][^\n]{25})' % eksik_n, b['metin'])
            if not m and eksik_n == 1 and n0 == 0: m = re.match(r'()1\s+(?=\([A-Z]\))', b['metin'])  # "1 (A) Mahkeme:" biçimi
            if not m or (m.start() == 0 and n0 != 0): continue
            once, sonra = b['metin'][:m.start()].rstrip(), b['metin'][m.end():].strip()
            kenar_ek = [x for x in once.split('\n')[-3:] if KENAR_RE.match(x.strip()) or re.fullmatch(r'\d+\s+Cilt\s+[IVX]+', x.strip())]
            if kenar_ek: once = '\n'.join(once.split('\n')[:-len(kenar_ek)]).rstrip()
            if m.group(1): kenar_ek.append(m.group(1).strip())
            yeni = {'no': f'Emir {e} n.{eksik_n}', 'baslik': b['baslik'], 'metin': sonra, 'kenar': ' · '.join(kenar_ek)}
            if once: b['metin'] = once; birimler.insert(i0 + 1, yeni)
            else: b.update(yeni)  # başlık biriminde metin yoksa birim doğrudan bu nizam olur
            ayrilan.append(f'Emir {e} n.{eksik_n}'); degisti = True; break
        if degisti: break
print('ayrılan yapışık nizam', len(ayrilan), ayrilan)

# formlar
FT = satirlar[FORM_BAS + 1:]
FRE = re.compile(r'^[ \t]*(?:FORM|Form)[ \t]*(?:No|NO)?[ \t]*[.:;]?[ \t]*([0-9l]+(?:[ \t]?[A-ZİÇ](?![A-Za-zÇĞİÖŞÜçğıöşü]))?)[ \t]*[.:]?[ \t]*(.*)$')
fb = [i for i, s in enumerate(FT) if FRE.match(s)]
for k, i in enumerate(fb):
    m = FRE.match(FT[i]); son = fb[k + 1] if k + 1 < len(fb) else len(FT)
    no = m.group(1).replace('l', '1').replace(' ', '')
    gov = ([m.group(2)] if m.group(2).strip() else []) + [x.replace('\t', ' ') for x in FT[i + 1:son]]
    bas = next((x.strip() for x in gov if x.strip() and not KENAR_RE.match(x.strip())), '')
    ekle(f'Form {no}', re.split(r'\s+DAVACI\s*:|\.{4,}', bas)[0].strip(' .')[:120], [x for x in gov if not KENAR_RE.match(x.strip())], [x.strip() for x in gov if KENAR_RE.match(x.strip())])

nos = [b['no'] for b in birimler]
cift = sorted({n for n in nos if nos.count(n) > 1})
toplam_sonra = len(re.sub(r'\s+', '', ''.join(b['metin'] + b['kenar'].replace(' · ', '') for b in birimler)))
kayip = 1 - toplam_sonra / toplam_once
emirler = list(dict.fromkeys(b['no'].split(' n.')[0] for b in birimler if b['no'].startswith('Emir')))
print('birim', len(birimler), 'emir', len(emirler), 'nizam', sum(' n.' in n for n in nos), 'form', sum(n.startswith('Form') for n in nos), 'çift', cift, 'metin kaybı %.2f%%' % (100 * kayip))
print(', '.join(emirler))
if cift or abs(kayip) > 0.02 or len(emirler) < 70: sys.exit('denetim geçmedi, yazılmadı')
paket[KOD] = [{'no': b['no'], 'baslik': b['baslik'], 'metin': b['metin']} | ({'kenar': b['kenar'][:300]} if b['kenar'] else {}) for b in birimler]
json.dump(paket, open(PUB + f"tum-{y['b']}.json", 'w'), ensure_ascii=False)
y['y'] = 'madde'; y['mc'] = len(birimler); y['k'] = 'dogrudan-hmut'
y.pop('em', None)  # eski (LibreOffice) madde sayımından kalan 'okunamayan madde' uyarısı Emir/nizam yapısında geçersiz
y['bs'] = ' '.join(dict.fromkeys(b['baslik'] for b in birimler if b['no'].startswith('Emir') and b['baslik']))[:2000]
json.dump(dz, open(PUB + 'tum-dizin.json', 'w'), ensure_ascii=False)
