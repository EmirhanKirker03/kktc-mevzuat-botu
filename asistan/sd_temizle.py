"""sonraki_degisiklikler.json'daki 'metne işlenmemiş değişiklik' girdilerini denetler: Yüksek Mahkeme metni (yeniden
indirildikten sonra) değişiklik sayısını artık içeriyorsa girdi kaldırılır ve sd_islenmis.json'a nedeniyle yazılır.
build_tum.py'den önce çalıştırılır. Yalnızca kaldırır; yeni girdi eklemez, metne dokunmaz."""
import json, os, re, datetime
D = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(D); M = REPO + '/veri/mahkemeler'
kayit = json.load(open(M + '/yasa-kayit.json')); lo = json.load(open(M + '/yasa-lo-kayit.json'))
ocr = {}
for f in os.listdir(M + '/ocr-kayit'): ocr.update(json.load(open(M + '/ocr-kayit/' + f)))
def taban(pk):
    for s in (lo, kayit, ocr):
        p = s.get(pk)
        if p and p.get('durum') == 'tamam' and os.path.exists(REPO + '/' + p['metin_dosyasi']):
            return open(REPO + '/' + p['metin_dosyasi'], encoding='utf-8', errors='replace').read()
    return ''
SDF = os.path.join(D, 'sonraki_degisiklikler.json'); ISF = os.path.join(D, 'sd_islenmis.json')
sd = json.load(open(SDF, encoding='utf-8'))
isl = json.load(open(ISF, encoding='utf-8')) if os.path.exists(ISF) else {'aciklama': '', 'liste': []}
kalan, cik = {}, []
for pk, v in sd.items():
    duz = re.sub(r'\s', '', taban(pk)[:4000])  # yalnızca baştaki '... sayılı değişiklik yasalarıyla birleştirilmiş' listesi
    for d in v:
        no, y = d['degisiklik'].split('/')
        if duz and re.search(rf'(?<!\d)0?{int(no)}/{y}(?!\d)', duz):
            cik.append({'pkey': int(pk), 'degisiklik': d['degisiklik'], 'neden': 'Yüksek Mahkeme metninin başındaki değişiklik listesinde artık var',
                        'tarih': datetime.date.today().isoformat()})
        else: kalan.setdefault(pk, []).append(d)
if cik:
    json.dump(kalan, open(SDF, 'w', encoding='utf-8'), ensure_ascii=False)
    isl['liste'] += cik
    json.dump(isl, open(ISF, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('kaldırılan:', [(c['pkey'], c['degisiklik']) for c in cik], '| kalan:', {k: [d['degisiklik'] for d in v] for k, v in kalan.items()})
