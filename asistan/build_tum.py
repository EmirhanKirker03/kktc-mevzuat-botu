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
import onar
ONAR = collections.Counter()  # kodlama onarımı istatistiği (onar.py)
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
# Yüksek Mahkeme sisteminde dosyası olmayan yasalar için Meclis arşivindeki metinler (meclis_ek.py)
MEK = oku(os.path.join(M.replace('mahkemeler', 'meclis-ek'), 'kayit.json')).get('kayitlar', {})
from anayasa_bol import ayir as anayasa_ayir
# Yasa notları: metnin yürürlük durumu hakkında doğrulanmış bilgi (kaynaklar asistan/README.md'de)
RED_2014 = '29 Haziran 2014 halkoylamasında reddedildi (%62,3 hayır); bu Anayasa değişikliği YÜRÜRLÜĞE GİRMEMİŞTİR. Yürürlükteki Anayasa metni için Anayasa\'nın kendisine bakın.'
RED = {39, 41, 42}  # halkoylamasında reddedilen Anayasa değişiklikleri
NOTLAR = {
    41: RED_2014, 42: RED_2014,
    39: '11 Ekim 2020 halkoylamasında reddedildi (%50,13 hayır); bu Anayasa değişikliği (Yüksek Mahkeme yargıç sayısı, m.143) YÜRÜRLÜĞE GİRMEMİŞTİR.',
    38: 'Bu değişiklik (Anayasa m.162) Meclis\'in yayımladığı güncel Anayasa metnine işlenmemiştir; 2014 halkoylaması 1985\'ten bu yana ilk Anayasa değişikliği oylaması olarak kayıtlıdır. Yürürlüğe girmemiş görünmektedir — resmî kaynaktan doğrulayın.',
    35: '29 Haziran 2014 halkoylaması için çıkarılmış geçici yasadır; söz konusu Anayasa değişikliği halkoylamasında reddedilmiştir.',
}
yasalar, istat = [], collections.Counter()
TR_AD = {}  # Türkçe metni olmayan fasılların Türkçe adları (İngilizce metne eklenir, Türkçe aramada bulunsun diye)
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
    meclis = None
    if not metin and tur == 'yasa' and str(pk) in MEK:
        meclis = MEK[str(pk)]; kaynak = 'meclis'
        metin = open(os.path.join(REPO, meclis['esas']['metin_dosyasi']), encoding='utf-8').read()
    if not metin:
        istat[tur + ' metin yok'] += 1
        fm = re.match(r'\s*(?:Fasıl\s*)?(\d+)\s*([A-Z]?)\s*$', str(k['numara'])) if tur == 'yasa' else None
        if fm and not re.search(r'[a-z]{3,} law', k['ad'], re.I): TR_AD[fm.group(1) + fm.group(2)] = re.sub(r'\s+', ' ', k['ad']).strip()
        continue
    def temizle(t):
        t = t.replace('\r', '').replace('\f', '\n').replace('\xa0', ' ').replace('\ufffd', '')  # okunamayan karakterler (kaynak dosyada da bozuk) çıkarılır
        t = onar.onar(t, ONAR)  # PDF yazı tipi kayması, 1254 kodlama karışması, çöp karakter dizileri
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
    if meclis and meclis['degisiklik']:
        maddeler = [{'no': 'Değişiklik ' + d['sayi'], 'baslik': d['baslik'] + ' (Meclis arşivindeki değişiklik yasası; esas metne işlenmemiş)', 'metin': temizle(open(os.path.join(REPO, d['metin_dosyasi']), encoding='utf-8').read()).strip(), 'sd': True, 'u': d['url']} for d in meclis['degisiklik']] + maddeler
    if meclis: istat['yasa meclis-ek'] += 1
    if ocrmu:  # yazı tanımada kenar başlıkları güvenilir okunamıyor; yanıltmasın diye boş bırakılır
        for m in maddeler: m['baslik'] = ''
    ornek = ' ' + metin[:20000].lower() + ' '
    ingilizce = ornek.count(' the ') + ornek.count(' of ') > 3 * (ornek.count(' ve ') + ornek.count(' bir ') + 1)
    ad = re.sub(r'\s+', ' ', k['ad']).strip()
    gy = (GY.get(pk, []) if tur == 'yasa' else []) + (meclis.get('degisiklik_sayilari', []) if meclis else [])
    yasalar.append({'p': pk if tur == 'yasa' else 'T' + str(pk), 'tz': tur == 'tuzuk', 'n': re.sub(r'\s+', ' ', str(k['numara'])), 'a': ad, 'u': meclis['esas']['url'] if meclis else k['url'], 'k': kaynak, 'o': ocrmu,
                    'ks': 'meclis' if meclis else '', 'nt': NOTLAR.get(pk, '') if tur == 'yasa' else '', 'ry': tur == 'yasa' and pk in RED,
                    'y': ayirma, 'en': ingilizce, 'gy': gy, 'kd': bool(re.search(r'yürürlükten\s+kaldır|ilga edil', ad, re.I)), 'em': eksik if ayirma == 'madde' else [], 'm': maddeler})

for y in yasalar:
    if y.get('en') and str(y['n']).strip() in TR_AD:
        y['a'] = y['a'] + ' (Fasıl ' + str(y['n']).strip() + ' ' + TR_AD[str(y['n']).strip()] + ' — Türkçe metni bulunamadı, İngilizce metin)'; istat['ingilizceye türkçe ad'] += 1

# KKTC Anayasası (Meclis arşivi; Yüksek Mahkeme sisteminde yok)
if 'ANAYASA' in MEK:
    A = MEK['ANAYASA']; giris, ams = anayasa_ayir(open(os.path.join(REPO, A['esas']['metin_dosyasi']), encoding='utf-8').read())
    ams = [{'no': 'Başlangıç', 'baslik': 'Başlangıç (Anayasa m.163 uyarınca metinden sayılır)', 'metin': re.sub(r'^BAŞLANGIÇ\s*', '', giris).strip()}] + [{'no': ('Geçici ' + m['no'].split()[-1]) if m['no'].startswith('Geçici') else m['no'], 'baslik': m['baslik'], 'metin': m['metin']} for m in ams]
    yasalar.append({'p': 'AY', 'tz': False, 'n': 'Anayasa', 'a': 'Kuzey Kıbrıs Türk Cumhuriyeti Anayasası', 'u': A['esas']['url'], 'k': 'meclis', 'o': False, 'ks': 'meclis',
                    'nt': 'Cumhuriyet Meclisi\'nin yayımladığı yürürlükteki Anayasa metni (1985). 2014 (47/2014) ve 2020 (33/2020) değişiklik yasaları halkoylamasında reddedildiği için metne işlenmemiştir; doğru olan budur.',
                    'y': 'madde', 'en': False, 'gy': [], 'kd': False, 'em': [], 'm': ams})
    istat['anayasa madde'] = len(ams)

# Yasa Gücünde Kararnameler (Meclis arşivi; meclis-ygk/kayit.json)
YGK_NOT = ('Yasa Gücünde Kararname (Bakanlar Kurulu). Metin Cumhuriyet Meclisi\'ne sunulan hâlidir; başta gerekçe bulunabilir. '
           'Kararnameler çoğu zaman belirli bir süre için çıkarılır, sonradan değiştirilebilir veya Meclis\'çe kaldırılabilir: yürürlük durumunu Resmî Gazete\'den doğrulayın.')
def buyuk(sat):
    h = [c for c in sat if c.isalpha()]
    return len(h) >= 15 and sum(1 for c in h if c.isupper()) / len(h) > 0.85 and 'GEREKÇE' not in sat.upper().replace('İ', 'I').replace('GEREKCE', 'GEREKÇE')
def ygk_govde_bas(t):
    """Kararname metninin başladığı konum (gerekçeden sonra). Önce 'aşağıdaki ... Kararnameyi yapar' cümlesinin hemen üstündeki
    büyük harfli başlık; yoksa 'GEREKÇE' bölümünden sonraki ilk büyük harfli başlık; o da yoksa 0."""
    satirlar = t.split('\n'); konum = [0]
    for x in satirlar: konum.append(konum[-1] + len(x) + 1)
    mm = re.search(r'(?:aşağıdaki|asagidaki)[^\n]{0,100}?(?:Kararname(?:yi)?)\s+yapar', t, re.I)
    if mm:
        i = t.count('\n', 0, mm.start()); j = i - 1; bas = i
        while j >= 0 and (not satirlar[j].strip() or buyuk(satirlar[j])) and i - j < 12:
            if satirlar[j].strip(): bas = j
            j -= 1
        return konum[bas]
    g = [i for i, x in enumerate(satirlar) if re.search(r'GEREKÇE', x.upper())]
    if g:
        for i in range(g[-1] + 1, len(satirlar)):
            if buyuk(satirlar[i]) and len(satirlar[i].strip()) >= 25 and not re.match(r'\s*MADDE', satirlar[i].upper()): return konum[i]
    return 0
YG = oku(os.path.join(M.replace('mahkemeler', 'meclis-ygk'), 'kayit.json')).get('kayitlar', [])
gorulen = set()
for g in YG:
    t = onar.onar(open(os.path.join(REPO, g['metin_dosyasi']), encoding='utf-8').read().replace('\r', '').replace('\f', '\n').replace('\xa0', ' ').replace('\ufffd', ''), ONAR)
    if g['cikarim'] == 'ocr': t = re.sub(r'\[SAYFA \d+\]\n?', '\n', t)
    if len(t.strip()) < 80: istat['ygk metin yok'] += 1; continue
    gerekce, govde = '', t
    bas = ygk_govde_bas(t)
    if bas > 0: gerekce, govde = t[:bas].strip(), t[bas:]
    try: ms = ayir(govde, 0)
    except Exception: ms = []
    kapsam = sum(len(m['metin']) for m in ms) / max(1, len(govde))
    if len(ms) >= 2 and kapsam > 0.5:
        bir = [{'no': m['no'], 'baslik': '' if g['cikarim'] == 'ocr' else m['baslik'], 'metin': m['metin'], **({'kaldirildi': True} if m['kaldirildi'] else {})} for m in ms]; ay = 'madde'
    else:
        bir = parcala(govde); ay = 'parca'
    if gerekce and len(gerekce) > 40: bir = [{'no': 'Gerekçe', 'baslik': 'Kararnamenin gerekçesi (yürürlükteki metin değildir)', 'metin': re.sub(r'[ \t]+', ' ', gerekce)[:12000]}] + bir
    kimlik = re.match(r'(\d{5,8})_', g['dosya'])
    p = 'G' + (kimlik.group(1) if kimlik else 'h' + __import__('hashlib').md5(g['dosya'].encode()).hexdigest()[:8])
    if p in gorulen: p += 'b'
    gorulen.add(p)
    istat['ygk ' + ay + (' (ocr)' if g['cikarim'] == 'ocr' else '')] += 1
    yasalar.append({'p': p, 'tz': False, 'yg': True, 'n': 'YGK ' + g['tarih'], 'a': re.sub(r'\s+', ' ', g['ad']).strip(), 'u': g['url'], 'k': 'meclis-ygk', 'o': g['cikarim'] == 'ocr',
                    'ks': 'meclis', 'nt': YGK_NOT, 'y': ay, 'en': False, 'gy': [], 'kd': False, 'em': [], 'm': bir})

# Resmî Gazete Ek III: Yüksek Mahkeme sisteminde olmayan tüzük, emirname, yönetmelik ve tebliğler (rg_bol.py → veri/resmi-gazete)
RGK = oku(os.path.join(M.replace('mahkemeler', 'resmi-gazete'), 'kayit.json')).get('kayitlar', [])
def trbaslik(x):
    x = x.replace('I', 'ı').replace('İ', 'i').lower()
    x = re.sub(r'(^|[\s()\-–/"])(\w)', lambda m: m.group(1) + ('İ' if m.group(2) == 'i' else m.group(2).upper()), x)
    return re.sub(r'(?<=\s)(Ve|İle|Veya)(?=\s)', lambda m: m.group(1).replace('İ', 'i').lower(), x)
TUR_AD = {'tuzuk': 'Tüzük', 'emirname': 'Emirname', 'yonetmelik': 'Yönetmelik', 'teblig': 'Tebliğ'}
for g in RGK:
    t = onar.onar(open(os.path.join(REPO, g['metin_dosyasi']), encoding='utf-8').read().replace('\ufffd', ''), ONAR)
    t = re.sub(r'\[SAYFA \d+\]\n?', '\n', t)
    try: ms = ayir(t, 0)
    except Exception: ms = []
    kapsam = sum(len(m['metin']) for m in ms) / max(1, len(t))
    if len(ms) >= 2 and kapsam > 0.5 and ms[0]['no'] == '1':
        bir = [{'no': m['no'], 'baslik': '', 'metin': m['metin'], **({'kaldirildi': True} if m['kaldirildi'] else {})} for m in ms]; ay = 'madde'
    else: bir = parcala(t); ay = 'parca'
    ad = re.sub(r'\s+', ' ', g['baslik']).strip()
    ad = re.sub(r'^(.{0,120}?YASASI)\s*[-–]\s*', '', ad) or ad  # 'X YASASI-' öneki (yetki veren yasa) addan ayrılır
    istat['rg ' + g['tur'] + ' ' + ay] += 1
    yasalar.append({'p': 'R' + g['ae'].replace('/', '_'), 'tz': True, 'rt': g['tur'], 'n': TUR_AD[g['tur']] + ' A.E. ' + g['ae'], 'a': trbaslik(ad) if ad.isupper() else ad,
                    'u': g['url'], 'k': 'resmi-gazete', 'o': g.get('ocr', False), 'ks': 'rg',
                    'nt': 'Resmî Gazete (' + g['tarih'] + ', Sayı ' + g['sayi'] + ', Ek III, A.E. ' + g['ae'] + ') metninden alınmıştır; yayımlandığı hâlidir — sonradan değiştirilmiş veya kaldırılmış olabilir.' + (' Eski sayı: metin yazı tanıma ile okunmuş, kelime hataları olabilir.' if g.get('ocr') else ''),
                    'y': ay, 'en': False, 'gy': [], 'kd': False, 'em': [], 'm': bir})

# aynı adla birden çok kez çıkarılan kararnameler: en yenisi dışındakiler işaretlenir ve aramada geriye alınır
def _tarih(n): g, a, y = n.split()[-1].split('/'); return y + a + g
gruplar = collections.defaultdict(list)
for y in yasalar:
    if y.get('yg'): gruplar[' '.join(w for w in fold(re.sub(r'\s*\([^()]*\)\s*$', '', y['a'])).split() if not re.fullmatch(r'(19|20)\d\d', w))].append(y)  # sondaki komite notu: '(Hukuk Komitesi)'
# Resmî Gazete metinleri: yazım farkları ve yazım hataları olduğundan ada göre benzerlik kümelemesi (yıl ve 'değişiklik' sözcükleri sayılmaz)
_RGSTOP = {'degis', 'emirn', 'tuzug', 'yasas', 'yonet', 'tebli', 'iliski', 'hakki'}
import difflib
def _rgk(a): return ''.join(w for w in fold(a).split() if not re.fullmatch(r'\d+', w) and w[:5] not in _RGSTOP)
_sk = collections.Counter(w for y in yasalar if y.get('rt') for w in set(fold(y['a']).split()))
def _nadir(a): return [w for w in set(fold(a).split()) if _sk[w] < 25 and not re.fullmatch(r'\d+', w) and len(w) > 2]
def _karsilik(A, B):  # A'daki her nadir sözcüğün (yer adı vb.) B'de yazım hatası payıyla karşılığı olmalı
    return all(any(difflib.SequenceMatcher(None, a, b).ratio() >= 0.75 for b in B) for a in A)
kumeler = []
for y in yasalar:
    if not y.get('rt'): continue
    k, nd = _rgk(y['a']), _nadir(y['a'])
    for km in kumeler:
        if km[0] == y['rt'] and abs(len(k) - len(km[1])) < 12 and difflib.SequenceMatcher(None, k, km[1]).ratio() >= 0.9 \
           and _karsilik(nd, km[3]) and _karsilik(km[3], nd): km[2].append(y); break
    else: kumeler.append((y['rt'], k, [y], nd))
for i, km in enumerate(kumeler): gruplar['__rg%d' % i] = km[2]
for g in gruplar.values():
    if len(g) < 2: continue
    g.sort(key=lambda y: _tarih(y['n']) if y.get('yg') else y['n'].split('/')[-1] + '%05d' % int(re.search(r'A\.E\. (\d+)', y['n']).group(1)), reverse=True)
    for y in g[1:]:
        y['ry'] = True; y['nt'] = 'Aynı adla daha yeni bir metin var (' + g[0]['n'] + '); bu eski sürümdür. ' + y['nt']; istat['eski sürüm'] += 1

# metni boş çıkan maddeler: kaynak PDF'de madde numaraları metinden ayrı bir sütunda olduğu için metin sonraki maddeye
# toplanmıştır. Boş madde(ler) metni taşıyan maddeyle birleştirilip '1–5' gibi aralık numarasıyla ve açıklayıcı notla verilir.
def _bos(m): return not m['metin'].strip() and not m.get('sd')
def bos_birlestir(ms):
    out, bek = [], []
    for m in ms:
        if _bos(m) and not str(m['no']).startswith(('Parça', 'Değişiklik')): bek.append(m); continue
        if bek and not m.get('sd') and not str(m['no']).startswith(('Parça', 'Değişiklik')):
            grup = bek + [m]
            uzun = [g['baslik'] for g in grup if len(g['baslik']) > 80]
            kisa = [g['baslik'] for g in grup if g['baslik'].strip() and len(g['baslik']) <= 80]
            no = str(grup[0]['no']) + '–' + str(m['no'])
            not_ = '[Kaynak dosyada madde numaraları metinden ayrı yazıldığı için ' + no + '. maddelerin metni birlikte verilmiştir; madde sınırları için resmî metne bakın.]\n'
            out.append({**m, 'no': no, 'baslik': '; '.join(kisa), 'metin': not_ + '\n'.join(uzun + [m['metin']]), 'birlesik': True})
            istat['boş madde birleştirildi'] += len(bek); bek = []; continue
        out.extend(bek); bek = []; out.append(m)
    if bek:  # sonda kalan boş maddeler: metinleri büyük olasılıkla bir önceki maddede
        o = out[-1] if out and not out[-1].get('sd') and not str(out[-1]['no']).startswith(('Parça', 'Değişiklik')) and out[-1]['metin'].strip() else None
        if o:
            ilk = str(o['no']).split('–')[0]; no = ilk + '–' + str(bek[-1]['no'])
            metin = re.sub(r'^\[Kaynak dosyada madde numaraları[^\]]*\]\n', '', o['metin'])
            kisa = [g['baslik'] for g in [o] + bek if g['baslik'].strip() and len(g['baslik']) <= 80]
            out[-1] = {**o, 'no': no, 'baslik': '; '.join(kisa), 'metin': '[Kaynak dosyada madde numaraları metinden ayrı yazıldığı için ' + no + '. maddelerin metni birlikte verilmiştir; madde sınırları için resmî metne bakın.]\n' + metin, 'birlesik': True}
            istat['boş madde birleştirildi'] += len(bek)
        else:
            out.extend(bek)
    return out
for y in yasalar:
    y['m'] = bos_birlestir(y['m'])
    for m in y['m']:
        if not m['metin'].strip() and not m.get('sd'):
            m['metin'] = '[Bu maddenin metni kaynak dosyadan çıkarılamadı. Lütfen resmî metne bakın.]'; istat['boş madde notu'] += 1

# onarımdan sonra hâlâ okunamayan bölümler: anlamsız metin gösterilmez, açık bir not konur
for y in yasalar:
    for m in y['m']:
        if m.get('sd'): continue
        bas = onar.okunamaz_bas(m['metin'])  # okunamayan metinde baştaki okunur satırlar (ör. Resmî Gazete başlığı) korunur
        if bas is not None: m['metin'] = (bas + '\n' if bas else '') + onar.OKUNAMAZ_NOT; m['okunamaz'] = True; ONAR['okunamaz bölüm'] += 1

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
    dizin.append({x: y[x] for x in ('p', 'n', 'a', 'u', 'k', 'o', 'y', 'kd', 'en', 'tz', 'gy', 'em', 'ks', 'nt', 'ry', 'yg', 'rt') if x in y and y[x] not in (False, [], '')} | {'mc': len(y['m']), 'b': len(paketler), 'kw': ' '.join(top), 'bs': basliklar})
if paket: paketler.append(paket)
os.makedirs(os.path.join(D, 'app/pub'), exist_ok=True)
for f in os.listdir(os.path.join(D, 'app/pub')):
    if re.match(r'tum-\d+\.json$', f): os.remove(os.path.join(D, 'app/pub', f))
for i, p in enumerate(paketler):
    json.dump(p, open(os.path.join(D, f'app/pub/tum-{i}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
json.dump({'alindi': '2026-10-09', 'kaynak': 'KKTC Yüksek Mahkeme mevzuat sistemi (mevzuat.mahkemeler.net)', 'yasalar': dizin},
          open(os.path.join(D, 'app/pub/tum-dizin.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('onarım:', dict(ONAR)); print(dict(istat), 'yasa:', len(yasalar), 'elle:', len(elle), 'paket:', len(paketler),
      'dizin MB:', round(os.path.getsize(os.path.join(D, 'app/pub/tum-dizin.json')) / 1e6, 2),
      'toplam MB:', round(sum(os.path.getsize(os.path.join(D, f'app/pub/tum-{i}.json')) for i in range(len(paketler))) / 1e6, 1))
