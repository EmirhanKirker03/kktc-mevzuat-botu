"""Yüksek Mahkeme sistemindeki TÜM yasaları (asistana elle eklenen 14 yasa dışındakiler) aranabilir hâle getirir.

Her yasa için en iyi metin kaynağı seçilir:
  1. LibreOffice ile çıkarılmış Word metni (yasalar-lo/; madde numaraları korunur)
  2. Önceki çıkarma (yasalar/; word-extractor, mammoth, pdf metni)
  3. Taranmış PDF'ler için yazı tanıma (ocr/) — kelime hataları olabilir, işaretlenir
Metin sirali_ayir ile maddelere ayrılır; ayırma güvenilir değilse metin sıralı "parça"lara bölünür ve öyle etiketlenir.
Çıktı: app/pub/tum-dizin.json (yasa listesi + arama anahtar kelimeleri) ve app/pub/tum-<n>.json (metin paketleri).
"""
import json, os, re, sys, math, collections
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
from sirali_ayir import ayir, ayir_lis, govde_bas, NUM_RE
REPO = '/home/claude/kktc-mevzuat-botu'
M = os.path.join(REPO, 'veri/mahkemeler')
ELLE = {24, 304, 351, 416, 577, 819, 943, 106, 107, 717, 250, 277, 898, 741}
PAKET_BAYT = 1_500_000

def oku(p):
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}

TR = str.maketrans('çğıöşüâîûÇĞİÖŞÜÂÎÛI', 'cgiosuaiuCGIOSUAIUI')
STOP = set('ve veya ile bir bu da de ki mi icin gibi olan olarak ne nasil hangi ama ancak her herhangi daha cok en yasa madde'.split())
def fold(s): return re.sub(r'[^a-z0-9 ]+', ' ', s.replace('I', 'ı').replace('İ', 'i').lower().translate(TR))
def toks(s): return [w[:5] for w in fold(s).split() if len(w) > 2 and w not in STOP]

def parcala(metin, boy=1800):
    paras = [p.strip() for p in re.split(r'\n\s*\n', metin) if p.strip()]
    out, buf = [], ''
    for p in paras:
        if buf and len(buf) + len(p) > boy: out.append(buf); buf = ''
        buf += ('\n\n' if buf else '') + p
        while len(buf) > boy * 2: out.append(buf[:boy]); buf = buf[boy:]
    if buf.strip(): out.append(buf)
    return [{'no': f'Parça {i + 1}', 'baslik': '', 'metin': re.sub(r'[ \t]+', ' ', t).strip(), 'parca': True} for i, t in enumerate(out)]

# güncellik_tum.py sonucu: Meclis kataloğunda olup metinde geçmeyen 2005 sonrası değişiklikler (olası eskilik uyarısı)
# Meclis'ten doğrulanmış, Yüksek Mahkeme metnine işlenmemiş sonraki değişiklikler (meclis_dogrula.py)
SD = json.load(open(os.path.join(D, 'sonraki_degisiklikler.json'), encoding='utf-8')) if os.path.exists(os.path.join(D, 'sonraki_degisiklikler.json')) else {}
GY = {int(k): [d['degisiklik'] for d in v] for k, v in SD.items()}
yasalar, istat = [], collections.Counter()
for tur in ('yasa', 'tuzuk'):
  ek = '' if tur == 'yasa' else '-' + tur
  kayit = oku(os.path.join(M, tur + '-kayit.json'))
  lo = oku(os.path.join(M, tur + '-lo-kayit.json'))
  ocr = {}
  od = os.path.join(M, 'ocr' + ek + '-kayit')
  if os.path.isdir(od):
      for f in os.listdir(od): ocr.update(oku(os.path.join(od, f)))
  for pk, k in sorted(kayit.items(), key=lambda x: int(x[0])):
    pk = int(pk)
    if tur == 'yasa' and pk in ELLE: continue
    kaynak, metin, ocrmu = None, None, False
    # LibreOffice metni numaraları korur ama bazı dosyalarda metin kutularını atlıyor: belirgin kısaysa önceki çıkarım kullanılır
    if str(pk) in lo and lo[str(pk)].get('durum') == 'tamam' and not (k.get('karakter') and lo[str(pk)]['karakter'] < 0.7 * k['karakter'] and k.get('durum') == 'tamam' and k.get('bicim') != 'rtf'):
        kaynak = 'libreoffice'; metin = open(os.path.join(REPO, lo[str(pk)]['metin_dosyasi']), encoding='utf-8').read()
    elif k.get('durum') == 'tamam':
        kaynak = k.get('bicim'); metin = open(os.path.join(REPO, k['metin_dosyasi']), encoding='utf-8').read()
    elif str(pk) in ocr and ocr[str(pk)].get('durum') == 'tamam':
        o = ocr[str(pk)]; kaynak = o.get('yontem', 'ocr'); ocrmu = kaynak.startswith('ocr')
        metin = open(os.path.join(REPO, o['metin_dosyasi']), encoding='utf-8').read()
    if not metin: istat[tur + ' metin yok'] += 1; continue
    def temizle(t):
        t = t.replace('\r', '').replace('\f', '\n').replace('\xa0', ' ').replace('\ufffd', '')  # okunamayan karakterler (kaynak dosyada da bozuk) çıkarılır
        return re.sub(r'\[SAYFA \d+\]\n?', '\n', t) if ocrmu else t
    def uygun(ms, esik, metin, b):
        if len(ms) < 3: return False
        kapsam = sum(len(m['metin']) for m in ms) / max(1, len(metin) - b)
        nums = [int(re.match(r'\d+', m['no']).group()) for m in ms]
        bosluk = (max(nums) - len(set(nums))) / max(nums)
        enbuyuk = max(len(m['metin']) for m in ms)
        return kapsam > 0.55 and bosluk < esik and not (enbuyuk > 30000 and enbuyuk > 0.35 * (len(metin) - b))
    def bos_oran(ms):
        k = sum(1 for m in ms if len(m['metin'].strip()) < 25 and not m['kaldirildi'])
        return k / max(1, len(ms)) if k >= 3 else 0.0
    def bol_bas(metin, b):
        try: ms = ayir(metin, b)
        except Exception: ms = []
        if uygun(ms, 0.25, metin, b): return ms, 'sirali'
        try: ms2 = ayir_lis(metin, b)
        except Exception: ms2 = []
        if len(ms2) >= 8 and ms2[0]['no'] == '1' and uygun(ms2, 0.2, metin, b): return ms2, 'lis'
        return None, None
    def bol(metin):
        """(maddeler, yöntem). Önce yasanın gövde başlangıcından bölünür; maddelerin çoğu boş çıkarsa (başta içindekiler
        veya madde gerekçeleri listesi varsa) metindeki sonraki "1." başlangıçları denenir, en çok dolu madde veren seçilir."""
        b = govde_bas(metin)
        ms, y = bol_bas(metin, b)
        if ms is not None and bos_oran(ms) <= 0.25: return ms, y
        adaylar = [m.start(1) for m in NUM_RE.finditer(metin, b) if m.group(1) in ('1', 'l') and not m.group(2)][:8]
        en, eny = (ms, y) if ms is not None else (None, None)
        puan = lambda x: sum(1 for m in x if len(m['metin'].strip()) >= 25) * (1 - bos_oran(x))
        for a in adaylar:
            if a <= b: continue
            x, yx = bol_bas(metin, max(0, a - 1))
            kisa_isim = x is not None and re.search(r'isimlendiril|olarak anıl|adlandırıl|cited as|Kısa [İi]sim', x[0]['metin'][:300] + ' ' + (x[0]['baslik'] or ''), re.I)
            if x is not None and kisa_isim and bos_oran(x) <= 0.25 and (en is None or puan(x) > puan(en)): en, eny = x, yx + '-yeniden'
        if en is not None and bos_oran(en) > 0.25: return None, None
        return en, eny
    metin = temizle(metin)
    ms, yontem = bol(metin)
    # LibreOffice metni ayrılamadıysa .doc/.docx'in doğrudan metin çıkarımı denenir (LibreOffice bazı başlık kutularını düşürüyor)
    if ms is None and kaynak == 'libreoffice' and k.get('durum') == 'tamam' and k.get('bicim') in ('doc', 'docx') and k.get('metin_dosyasi'):
        m2 = temizle(open(os.path.join(REPO, k['metin_dosyasi']), encoding='utf-8').read())
        ms2, y2 = bol(m2)
        if ms2 is not None: ms, yontem, metin, kaynak = ms2, y2 + '-dogrudan', m2, k['bicim']
    ms = ms or []
    eksik = []
    if ms:
        maddeler = [{'no': m['no'], 'baslik': m['baslik'], 'metin': m['metin'], **({'kaldirildi': True} if m['kaldirildi'] else {})} for m in ms]
        ayirma = 'madde'; istat[tur + ' yöntem ' + yontem] += 1
        var = {int(re.match(r'\d+', m['no']).group()) for m in ms}
        bos = [n for n in range(1, max(var)) if n not in var]
        for n in bos:  # ardışık eksikleri aralık yap: [11, 15]
            if eksik and eksik[-1][1] == n - 1: eksik[-1][1] = n
            else: eksik.append([n, n])
    else:
        maddeler = parcala(metin); ayirma = 'parca'
    istat[tur + ' ' + ayirma + (' (ocr)' if ocrmu else '')] += 1
    if tur == 'yasa' and str(pk) in SD:
        maddeler = [{'no': 'Değişiklik ' + d['degisiklik'], 'baslik': d['baslik'] + ' (metne işlenmemiş sonraki değişiklik)', 'metin': d['metin'], 'sd': True, 'u': d['url'], **({'ocr': True} if d.get('ocr') else {})} for d in SD[str(pk)]] + maddeler
    if ocrmu:  # yazı tanımada kenar başlıkları güvenilir okunamıyor; yanıltmasın diye boş bırakılır
        for m in maddeler: m['baslik'] = ''
    ornek = ' ' + metin[:20000].lower() + ' '
    ingilizce = ornek.count(' the ') + ornek.count(' of ') > 3 * (ornek.count(' ve ') + ornek.count(' bir ') + 1)
    ad = re.sub(r'\s+', ' ', k['ad']).strip()
    yasalar.append({'p': pk if tur == 'yasa' else 'T' + str(pk), 'tz': tur == 'tuzuk', 'n': re.sub(r'\s+', ' ', str(k['numara'])), 'a': ad, 'u': k['url'], 'k': kaynak, 'o': ocrmu,
                    'y': ayirma, 'en': ingilizce, 'gy': GY.get(pk, []) if tur == 'yasa' else [], 'kd': bool(re.search(r'yürürlükten\s+kaldır|ilga edil', ad, re.I)), 'em': eksik if ayirma == 'madde' else [], 'm': maddeler})

# elle doğrulanmış yasalar da dizine girer (metinleri sayfanın içinde; burada yalnızca arama anahtarları)
elle = []
kd_ = json.load(open(os.path.join(D, 'kira_denetim.json'), encoding='utf-8'))
elle.append({'p': 'KIRA', 'n': '17/1981', 'a': 'Kira (Denetim) Yasası', 'm': [{'baslik': a['title'], 'metin': a['text'] + ' ' + ' '.join(m.get('new_text', '') or '' for m in a.get('amendments', []))} for a in kd_['articles']]})
mv = json.load(open(os.path.join(D, 'mevzuat_dalga1.json'), encoding='utf-8'))['yasalar'] + [json.load(open(os.path.join(D, 'mevzuat_kat.json'), encoding='utf-8'))] + json.load(open(os.path.join(D, 'mevzuat_dalga2.json'), encoding='utf-8'))['yasalar']
for y in mv: elle.append({'p': y['kod'], 'n': y['no'], 'a': y['ad'], 'm': [{'baslik': m['baslik'], 'metin': m['metin']} for m in y['maddeler']]})
for e in elle: e.update({'u': '', 'k': 'elle', 'o': False, 'y': 'elle', 'kd': False})
yasalar = elle + yasalar
# arama anahtar kelimeleri: başlık + metnin tf-idf'e göre en ayırt edici 80 kökü
df = collections.Counter()
tfs = []
for y in yasalar:
    tf = collections.Counter(toks(' '.join(m['baslik'] + ' ' + m['metin'] for m in y['m'])))
    tfs.append(tf); df.update(tf.keys())
N = len(yasalar)
dizin, paketler, paket, boy = [], [], {}, 0
for y, tf in zip(yasalar, tfs):
    top = sorted(tf, key=lambda w: -(1 + math.log(tf[w])) * math.log(N / df[w]))[:80]
    basliklar = ' '.join(m['baslik'] for m in y['m'] if m['baslik'])[:1500]
    if y['k'] == 'elle':
        dizin.append({x: y[x] for x in ('p', 'n', 'a', 'u', 'k', 'o', 'y', 'kd')} | {'mc': len(y['m']), 'b': -1, 'kw': ' '.join(top), 'bs': basliklar, 'elle': True}); continue
    j = json.dumps(y['m'], ensure_ascii=False)
    if boy + len(j.encode()) > PAKET_BAYT and paket:
        paketler.append(paket); paket, boy = {}, 0
    paket[str(y['p'])] = y['m']; boy += len(j.encode())
    dizin.append({x: y[x] for x in ('p', 'n', 'a', 'u', 'k', 'o', 'y', 'kd', 'en', 'tz', 'gy', 'em') if x in y and y[x] not in (False, [])} | {'mc': len(y['m']), 'b': len(paketler), 'kw': ' '.join(top), 'bs': basliklar})
if paket: paketler.append(paket)
os.makedirs(os.path.join(D, 'app/pub'), exist_ok=True)
for f in os.listdir(os.path.join(D, 'app/pub')):
    if re.match(r'tum-\d+\.json$', f): os.remove(os.path.join(D, 'app/pub', f))
for i, p in enumerate(paketler):
    json.dump(p, open(os.path.join(D, f'app/pub/tum-{i}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
json.dump({'alindi': '2026-10-09', 'kaynak': 'KKTC Yüksek Mahkeme mevzuat sistemi (mevzuat.mahkemeler.net)', 'yasalar': dizin},
          open(os.path.join(D, 'app/pub/tum-dizin.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(dict(istat), 'yasa:', len(yasalar), 'elle:', len(elle), 'paket:', len(paketler),
      'dizin MB:', round(os.path.getsize(os.path.join(D, 'app/pub/tum-dizin.json')) / 1e6, 2),
      'toplam MB:', round(sum(os.path.getsize(os.path.join(D, f'app/pub/tum-{i}.json')) for i in range(len(paketler))) / 1e6, 1))
