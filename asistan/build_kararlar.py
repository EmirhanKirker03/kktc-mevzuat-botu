"""Yüksek Mahkeme kararlarını alanlara ayırır (Kira, Aile, İş, Tüketici, Trafik).

Kaynak: KKTC Yüksek Mahkeme mevzuat sistemi (mevzuat.mahkemeler.net) — bot deposundaki
liste/mahkemeler-karar.json ve veri/mahkemeler/kararlar/*.txt. Metinler değiştirilmez;
yalnızca satır sonları ve fazla boşluklar sadeleştirilir (parmak izi orijinal metne aittir).
"""
import json, re, os
from collections import Counter

REPO = '/home/claude/kktc-mevzuat-botu'
OUT = os.path.join(os.path.dirname(__file__), 'kararlar.json')
liste = json.load(open(os.path.join(REPO, 'liste/mahkemeler-karar.json')))

# alan: (künyede aranacak desen, metinde aranacak desen, metinde en az kaç kez geçmeli)
ALANLAR = {
    'KIRA': (r'Kira\s*\(\s*Denetim\s*\)|17/1981|17/81\b|Kira\s*\(?\s*Kontrol',
             r'Kira\s*\(\s*Denetim\s*\)|17/1981|17/81\b|Kira\s+Kontrol|Kira\s*\(\s*Kontrol', 1),
    'AILE': (r'Aile\s*\(Evlenme|1/1998|1/98\b|Fasıl\s*339|Türk Aile|boşanma|nafaka|velayet|nesep',
             r'Aile\s*\(Evlenme ve Boşanma\)\s*Yasası|1/1998|Türk Aile\s*\(Evlenme ve Boşanma\)|Fasıl\s*339', 2),
    'IS': (r'İş Yasası|22/1992|22/92\b|kıdem|ihbar tazminat|işten çıkar|hizmet akdi',
           r'İş Yasası|22/1992|22/92\b|kıdem tazminat|ihbar tazminat|haksız (?:olarak )?işten çıkar', 2),
    'TUKETICI': (r'Tüketici', r'Tüketicileri Koruma Yasası|40/2003', 1),
    'KAT': (r'Kat Mülkiyeti|35/2010|63/1987|kat irtifak|kat malik', r'Kat Mülkiyeti(?: ve Kat İrtifakı)? Yasası|35/2010|63/1987', 2),
    'TRAFIK': (r'Motorlu Araçlar ve Yol Trafik|21/1974|43/1991|Ceza Puanı|Davasız Halli|ehliyet|alkollü|ihtiyatsız|dikkatsiz|tehlikeli sürüş',
               r'Motorlu Araçlar ve Yol Trafik Yasası|21/1974|Ceza Puanı Yasası|43/1991', 2),
    'CEZA': (r'Fasıl\s*15[45]\b|Ceza Yasası|Ceza Muhakemeleri', r'Ceza Yasası|Ceza Muhakemeleri Usulü Yasası|Fasıl\s*15[45]\b', 3),
    'BORCLAR': (r'Fasıl\s*14[89]\b|Sözleşmeler Yasası|Haksız Fiil', r'Sözleşmeler Yasası|Haksız Fiiller Yasası|Fasıl\s*14[89]\b', 2),
    'USUL': (r'Fasıl\s*6\b|Hukuk Muhakemeleri Usulü', r'Hukuk Muhakemeleri Usulü Yasası|Fasıl\s*6\b', 3),
    'MIRAS': (r'Fasıl\s*195\b|Vasiyet|Veraset|tereke|miras', r'Vasiyetnameler ve Veraset Yasası|Fasıl\s*195\b', 2),
    'SIRKET': (r'Fasıl\s*113\b|Şirketler Yasası', r'Şirketler Yasası|Fasıl\s*113\b', 2),
}
# yasanın yürürlük başlangıcı: daha önceki kararlar "eski mevzuat dönemi"
BASLANGIC = {'KAT': '2010-07-12', 'KIRA': '1981-04-14', 'AILE': '1998-01-01', 'IS': '1992-05-12', 'TUKETICI': '2003-06-03', 'TRAFIK': '1974-10-25', 'CEZA': '1900-01-01', 'BORCLAR': '1900-01-01', 'USUL': '1900-01-01', 'MIRAS': '1900-01-01', 'SIRKET': '1900-01-01'}

def oku(k):
    p = k.get('metin_dosyasi')
    return open(os.path.join(REPO, p), encoding='utf-8').read() if p else ''

def sade(t):
    t = t.replace('\r\n', '\n').replace('\r', '\n').replace('\t', ' ')
    t = re.sub(r'[  ]{2,}', ' ', t)
    t = re.sub(r'\n[ ]+', '\n', t)
    return re.sub(r'\n{3,}', '\n\n', t).strip()

def kira_donem(tarih):
    if not tarih: return 'bilinmiyor'
    if tarih < '1981-04-14': return 'eski'
    if tarih < '2011-05-02': return 'ara'
    return 'guncel'

MADDE_RE = re.compile(r'(?:Md|M\.d|madde|m)\s*\.?\s*((?:\d{1,2}\s*(?:\(\s*\w{1,3}\s*\)\s*)*[,\s/ve-]*)+)', re.I)
def kira_maddeleri(yasa_madde, metin):
    bul = set(); ym = yasa_madde or ''
    i = ym.lower().find('kira')
    if i >= 0:
        seg = re.split(r'\s[-–]\s*(?:\d+\s*/\s*\d+|Fasıl)', ym[i:i + 160])[0]
        seg = re.sub(r'\([^)]*\)', ' ', seg)
        for m in MADDE_RE.finditer(seg):
            bul.update(re.findall(r'\b(\d{1,2})\b(?!\s*/)', m.group(1)))
    for m in re.finditer(r'Kira\s*\(\s*Denetim\s*\)\s*Yasas\w*', metin):
        pencere = metin[m.end():m.end() + 160]
        for x in re.finditer(r'(\d{1,2})\s*(?:\(\s*\d{1,2}\s*\))?\s*(?:\(\s*[a-zıçğöşü]\s*\))?\s*(?:[’\']?\s*(?:inci|ıncı|üncü|uncu|nci|ncı|nolu)?\s*madde|\(\s*\d)', pencere, re.I):
            bul.add(x.group(1))
    return sorted((n for n in bul if 1 <= int(n) <= 18), key=int)

out = []
for k in liste['kayitlar']:
    metin = oku(k)
    if len(metin.strip()) < 300: continue
    tur = k.get('TurGorunumAd') or ''
    meta = ' '.join(str(k.get(x) or '') for x in ['YasaMadde', 'Konu', 'Ozet'])
    alanlar = []
    for a, (mp, tp, en_az) in ALANLAR.items():
        if a == 'KIRA' and tur == 'Hukuk Kira İstinaf': alanlar.append(a); continue
        if a == 'AILE' and 'Aile' in tur: alanlar.append(a); continue
        if a == 'CEZA' and tur.startswith(('Yargıtay Ceza', 'Ceza İstinaf')): alanlar.append(a); continue
        if a in ('AILE', 'IS', 'TRAFIK', 'CEZA', 'BORCLAR', 'USUL', 'MIRAS', 'SIRKET') and tur in ('Yim', 'Yim İstinaf', 'Yüksek Seçim Kurulu', 'Anayasa Mahkemesi'):
            # idari ve anayasa davalarında yalnızca künye açıkça yasayı anıyorsa
            if re.search(tp, meta, re.I): alanlar.append(a)
            continue
        if re.search(mp, meta, re.I) or len(re.findall(tp, metin, re.I)) >= en_az:
            alanlar.append(a)
    if not alanlar: continue
    tarih = (k.get('Tarih') or '')[:10]
    out.append({
        'id': 'K' + str(k['Pkey']), 'tarih': tarih, 'tur': tur,
        'dno': f"{k.get('Dnumara') or ''}/{k.get('Yild') or ''}".strip('/'),
        'taraflar': (k.get('Taraflar') or '').strip(), 'konu': (k.get('Konu') or '').strip(),
        'yasa': (k.get('YasaMadde') or '').strip(), 'ozet': (k.get('Ozet') or '').strip(),
        'url': k.get('url'), 'metin_sha256': k.get('metin_sha256'),
        'alanlar': alanlar,
        'eski': [a for a in alanlar if tarih and tarih < BASLANGIC[a]],
        'donem': kira_donem(tarih) if 'KIRA' in alanlar else ('bilinmiyor' if not tarih else 'yasa'),
        'maddeler': kira_maddeleri(k.get('YasaMadde'), metin) if 'KIRA' in alanlar else [],
        'metin': sade(metin),
    })

out.sort(key=lambda x: x['tarih'] or '0', reverse=True)
json.dump({'ad': 'KKTC Yüksek Mahkeme kararları — Kira, Aile, İş, Tüketici, Trafik',
           'kaynak': 'KKTC Yüksek Mahkeme mevzuat sistemi (mevzuat.mahkemeler.net)',
           'alindi': liste.get('alindi', '')[:10], 'baslangic': BASLANGIC, 'kararlar': out},
          open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(out), 'karar,', round(os.path.getsize(OUT) / 1e6, 2), 'MB')
c = Counter(a for x in out for a in x['alanlar']); print(c)
for a in ALANLAR:
    xs = [x for x in out if a in x['alanlar']]
    print(a, 'eski dönem:', sum(1 for x in xs if a in x['eski']), '| örnek:', [(x['tarih'], x['konu'][:50]) for x in xs[:3]])
