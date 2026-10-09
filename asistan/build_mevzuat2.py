"""İkinci dalga yasalar: Ceza, CMUK, Sözleşmeler, Haksız Fiiller, HMUK, Vasiyetnameler ve Veraset, Şirketler.

Kaynak: Yüksek Mahkeme mevzuat sistemindeki (mevzuat.mahkemeler.net) birleştirilmiş resmî Word dosyaları.
Orijinaller bot deposunun 'orijinaller' dalında; parmak izleri secili-yasa-kayit.json'da. Dosyalar LibreOffice ile
düz metne çevrilir (Word'ün otomatik madde numaraları bu yolla korunur) ve sirali_ayir.py ile maddelere ayrılır.
Madde başlıkları metnin kenar başlıklarından alınır (içdüzeni bazen eski kalmıştır); kenar başlığı okunamazsa içdüzeni kullanılır.
Otomatik ayrılamayan madde numaraları 'ayrilamayan' alanında açıkça listelenir.
"""
import json, re, os, sys, hashlib, difflib
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
from sirali_ayir import ayir, govde_bas
REPO = '/home/claude/kktc-mevzuat-botu'
kayit = json.load(open(os.path.join(REPO, 'veri/mahkemeler/secili-yasa-kayit.json')))
cat = json.load(open(os.path.join(D, 'catalog/catalog.json')))
GRUP = {l.split('\t')[0]: l.split('\t')[1] for l in cat['tsv'].split('\n')}
YASALAR = [
    (106, 'CEZA', 'Ceza Yasası', 'Ceza', ['Ceza Yasası', 'Ceza (Değişiklik9 Yasası', 'Ceza Kanununu Tadil Eden Kanun']),
    (107, 'CMUK', 'Ceza Muhakemeleri Usulü Yasası', 'Ceza', ['Ceza Muhakemeleri Usulu Yasası', 'CEZA MUHAKEMELERİ USULÜ (DEĞİŞİKLİK) YASASI']),
    (717, 'SOZLESME', 'Sözleşmeler Yasası', 'Borçlar', ['Sözleşmeler Yasası', 'Sözleşme Yasası']),
    (250, 'HAKSIZ', 'Haksız Fiiller Yasası', 'Borçlar', ['Haksız Fiiller Yasası']),
    (277, 'HMUK', 'Hukuk Muhakemeleri Usulü Yasası', 'Usul', ['HUKUK MUHAKEMELERİ USULÜ (DEĞİŞİKLİK) YASASI']),
    (898, 'MIRAS', 'Vasiyetnameler ve Veraset Yasası', 'Miras', ['Vasiyetnameler ve Veraset Yasası', 'Vasiyet ve Tevarüs Yasası']),
    (741, 'SIRKET', 'Şirketler Yasası', 'Şirketler', ['ŞİRKETLER (DEĞİŞİKLİK) YASASI']),
]
def degisiklikler(bs):
    out = set()
    for b in bs:
        for it in GRUP.get(b, '').split('|'):
            m = re.match(r'^d0*(\d+)/(\d{4})', it)
            if m: out.add((int(m.group(2)), int(m.group(1))))
    return sorted(out)
def norm(s): return re.sub(r'[^a-zçğıöşü0-9]', '', s.replace('İ', 'i').replace('I', 'ı').lower())
def icduzeni(kod, bas):
    d = {}
    pats = {'CEZA': r'Madde\s*\n+\s*(\d+\s?[A-Z]?)\s*\n+\s*([^\n]+)', 'CMUK': r'Madde\s+(\d+[A-Z]?)\s*\t?\s*([^\n]+)', 'HMUK': r'(?m)^\s*(\d+[A-Z]?)\.\s*\t?\s*([^\n]+)'}
    if kod in pats:
        for n, t in re.findall(pats[kod], bas): d.setdefault(n.replace(' ', ''), t.strip(' .\t'))
    return d
def kotu(b): return not b or re.search(r'R\.G\.|^\d', b) or len(b) < 3 or '....' in b or not re.search(r'[a-zçğıöşü]{3}', b.lower()) or re.match(r'^[\d.()/ ]+$', b)

NOTLAR = {'HMUK': '13/2013 sayılı yasa Meclis kataloğunda bu yasanın değişiklikleri arasında listeleniyor ama birleştirilmiş metinde geçmiyor (metnin başlığında 9/1971, 23/1984, 31/2003, 86/2007, 12/2014 ve 37/2019 sayılıyor). Hukuk Muhakemeleri Usulü (Geçici Kurallar) Yasası (43/2012) ile ilgili olabilir — doğrulanmadı, avukat kontrol etmeli.'}
yasalar = []
for pkey, kod, ad, alan, bs in YASALAR:
    k = kayit[str(pkey)]
    dosya = os.path.basename(k['metin_dosyasi'])[:-4]
    ham = os.path.join(D, 'raw/d2/yasalar', dosya)
    assert hashlib.sha256(open(ham, 'rb').read()).hexdigest() == k['sha256'], dosya
    metin = open(os.path.join(D, 'raw/d2/txt', os.path.splitext(dosya)[0] + '.txt'), encoding='utf-8').read().replace('\r', '').replace('\f', '\n').replace('\xa0', ' ')
    b = govde_bas(metin); ic = icduzeni(kod, metin[:b])
    ms = ayir(metin, b)
    for m in ms:
        i = ic.get(m['no'])
        if m['no'] == '1' and (kotu(m['baslik']) or len(m['baslik']) > 40): m['baslik'] = i or 'Kısa İsim'
        elif kotu(m['baslik']) and i: m['baslik'] = i
        elif i and len(norm(i)) > len(norm(m['baslik'])) + 3 and norm(i).startswith(norm(m['baslik'])): m['baslik'] = i
        if m['no'] == '1': m['metin'] = re.sub(r'^[\s\S]*?(?=Bu Yasa)', '', m['metin'])
    # numarası metinde hiç görünmeyen maddeler: içdüzenindeki başlık önceki maddenin içinde bulunursa oradan ayrılır
    def anahtar(no): mm = re.match(r'(\d+)([A-Z]?)', no); return (int(mm.group(1)), mm.group(2))
    var = {m['no'] for m in ms}
    for n in sorted([n for n in ic if n not in var], key=anahtar):
        onceki = [m for m in ms if anahtar(m['no']) < anahtar(n)]
        if not onceki: continue
        o = onceki[-1]; satirlar = o['metin'].split('\n'); hedef = norm(ic[n])[:30]
        for j in range(1, len(satirlar)):
            birlesik = norm(' '.join(satirlar[j:j + 3]))
            if hedef and birlesik.startswith(hedef):
                # başlık kaç satıra yayılmış
                kk = j; acc = ''
                while kk < len(satirlar) and len(norm(acc)) < len(norm(ic[n])) and len(satirlar[kk]) < 120: acc += satirlar[kk] + ' '; kk += 1
                yeni = {'no': n, 'baslik': ic[n], 'metin': '\n'.join(satirlar[kk:]).strip(), 'kenar_notu': [], 'kaldirildi': False, 'numara_metinde_yok': True}
                o['metin'] = '\n'.join(satirlar[:j]).strip()
                ms.insert(ms.index(o) + 1, yeni); break
    ms.sort(key=lambda m: anahtar(m['no']))
    # tablo sütunlarından gövdeye karışmış kenar başlığı parçalarını çıkar (yalnız başlığın parçası olan kısa satırlar)
    for m in ms:
        nb = norm(m['baslik'])
        if len(nb) < 8: continue
        sat = m['metin'].split('\n')
        m['metin'] = '\n'.join(x for x in sat if not (len(x.strip()) < 35 and len(norm(x)) >= 6 and norm(x).rstrip('-') in nb and not x.strip().startswith('(')))
        m['metin'] = re.sub(r'(\w)-\n(?=[a-zçğıöşü])', r'\1', m['metin'])
    nums = [int(re.match(r'\d+', m['no']).group()) for m in ms]
    ayrilamayan = [str(i) for i in range(1, max(nums) + 1) if i not in nums] + [n for n in ic if n not in {m['no'] for m in ms} and re.match(r'\d+[A-Z]$', n)]
    for n in ayrilamayan:
        nn = int(re.match(r'\d+', n).group())
        onceki = [m for m in ms if int(re.match(r'\d+', m['no']).group()) < nn]
        if onceki:
            o = onceki[-1]
            o['durum_notu'] = ('kaldırıldı' if o['kaldirildi'] else 'yürürlükte' + (' (değişik)' if o['kenar_notu'] else '')) + \
                f' · dikkat: {n}. maddenin numarası resmî dosyada okunamadı; o maddenin metni bu maddenin sonunda olabilir'
    duz = re.sub(r'\s', '', metin)
    ds = degisiklikler(bs)
    kontrol = [{'yasa': f'{n}/{y}', 'metinde': bool(re.search(rf'(?<!\d)0?{n}/{y}', duz))} for y, n in ds if y >= 2005]
    son = [f'{n}/{y}' for y, n in ds][-1] if ds else None
    yasalar.append({'kod': kod, 'no': k['numara'].replace('  ', ' '), 'ad': ad, 'alan': alan,
        'kaynak': 'KKTC Yüksek Mahkeme mevzuat sistemi — birleştirilmiş resmî metin',
        'url': k['url'], 'sha256': k['sha256'], 'alindi': k['alindi'][:10],
        'son_degisiklik_meclis': son, 'guncellik_kontrolu': kontrol, 'ayrilamayan': ayrilamayan, 'not': NOTLAR.get(kod),
        'maddeler': [{x: m[x] for x in ('no', 'baslik', 'metin', 'kenar_notu', 'kaldirildi', 'numara_metinde_yok', 'durum_notu') if x in m} for m in ms]})
    print(f"{kod:9} {k['numara']:9} {len(ms):4} madde  başlıksız {sum(1 for m in ms if not m['baslik']):3}  ayrılamayan {ayrilamayan}  son:{son} eksik:{[c['yasa'] for c in kontrol if not c['metinde']]}")
json.dump({'ad': 'KKTC mevzuatı — ikinci dalga', 'yasalar': yasalar}, open(os.path.join(D, 'mevzuat_dalga2.json'), 'w', encoding='utf-8'), ensure_ascii=False)
