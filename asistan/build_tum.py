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
from sirali_ayir import ayir, govde_bas
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
GY = {x['pkey']: x['metinde_yok'] for x in (json.load(open(os.path.join(D, 'guncellik_tum.json'), encoding='utf-8')) if os.path.exists(os.path.join(D, 'guncellik_tum.json')) else []) if x.get('durum') == 'eksik'}
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
    if str(pk) in lo and lo[str(pk)].get('durum') == 'tamam':
        kaynak = 'libreoffice'; metin = open(os.path.join(REPO, lo[str(pk)]['metin_dosyasi']), encoding='utf-8').read()
    elif k.get('durum') == 'tamam':
        kaynak = k.get('bicim'); metin = open(os.path.join(REPO, k['metin_dosyasi']), encoding='utf-8').read()
    elif str(pk) in ocr and ocr[str(pk)].get('durum') == 'tamam':
        o = ocr[str(pk)]; kaynak = o.get('yontem', 'ocr'); ocrmu = kaynak.startswith('ocr')
        metin = open(os.path.join(REPO, o['metin_dosyasi']), encoding='utf-8').read()
    if not metin: istat[tur + ' metin yok'] += 1; continue
    metin = metin.replace('\r', '').replace('\f', '\n').replace('\xa0', ' ').replace('\ufffd', '')  # okunamayan karakterler (kaynak dosyada da bozuk) çıkarılır
    if ocrmu: metin = re.sub(r'\[SAYFA \d+\]\n?', '\n', metin)
    b = govde_bas(metin)
    ms = []
    try: ms = ayir(metin, b)
    except Exception: ms = []
    kapsam = sum(len(m['metin']) for m in ms) / max(1, len(metin) - b)
    nums = [int(re.match(r'\d+', m['no']).group()) for m in ms]
    bosluk = (max(nums) - len(set(nums))) / max(nums) if nums else 1
    enbuyuk = max((len(m['metin']) for m in ms), default=0)
    if len(ms) >= 3 and kapsam > 0.55 and bosluk < 0.25 and not (enbuyuk > 30000 and enbuyuk > 0.35 * (len(metin) - b)):
        maddeler = [{'no': m['no'], 'baslik': m['baslik'], 'metin': m['metin'], **({'kaldirildi': True} if m['kaldirildi'] else {})} for m in ms]
        ayirma = 'madde'
    else:
        maddeler = parcala(metin); ayirma = 'parca'
    istat[tur + ' ' + ayirma + (' (ocr)' if ocrmu else '')] += 1
    if ocrmu:  # yazı tanımada kenar başlıkları güvenilir okunamıyor; yanıltmasın diye boş bırakılır
        for m in maddeler: m['baslik'] = ''
    ornek = ' ' + metin[:20000].lower() + ' '
    ingilizce = ornek.count(' the ') + ornek.count(' of ') > 3 * (ornek.count(' ve ') + ornek.count(' bir ') + 1)
    ad = re.sub(r'\s+', ' ', k['ad']).strip()
    yasalar.append({'p': pk if tur == 'yasa' else 'T' + str(pk), 'tz': tur == 'tuzuk', 'n': re.sub(r'\s+', ' ', str(k['numara'])), 'a': ad, 'u': k['url'], 'k': kaynak, 'o': ocrmu,
                    'y': ayirma, 'en': ingilizce, 'gy': GY.get(pk, []) if tur == 'yasa' else [], 'kd': bool(re.search(r'yürürlükten\s+kaldır|ilga edil', ad, re.I)), 'm': maddeler})

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
    dizin.append({x: y[x] for x in ('p', 'n', 'a', 'u', 'k', 'o', 'y', 'kd', 'en', 'tz', 'gy') if x in y and y[x] not in (False, [])} | {'mc': len(y['m']), 'b': len(paketler), 'kw': ' '.join(top), 'bs': basliklar})
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
