"""İlk dalga yasaları (Yüksek Mahkeme'nin birleştirilmiş resmî metinleri) maddelere ayırıp tek veri setinde toplar.

Kaynak: bot deposu veri/mahkemeler/secili/ (mevzuat.mahkemeler.net'ten indirilen dosyaların metni).
Her yasanın birleştirilmiş metninin Meclis arşivindeki 2005 sonrası tüm değişiklikleri içerip içermediği
kontrol edilir ve sonuç veri setine yazılır.
"""
import json, re, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from madde_ayir import ayir

REPO = '/home/claude/kktc-mevzuat-botu'
kayit = json.load(open(os.path.join(REPO, 'veri/mahkemeler/secili-yasa-kayit.json')))
cat = json.load(open(os.path.join(os.path.dirname(__file__), 'catalog/catalog.json')))
GRUP = {l.split('\t')[0]: l.split('\t')[1] for l in cat['tsv'].split('\n')}

YASALAR = [  # pkey, kod, kısa ad, alan, Meclis kataloğundaki değişiklik başlıkları
    (24, 'AILE', 'Aile (Evlenme ve Boşanma) Yasası', 'Aile', ['Aile (Evlenme ve Boşanma) Yasası']),
    (304, 'IS', 'İş Yasası', 'İş', ['İş Yasası', 'Is Yasasi']),
    (819, 'TUKETICI', 'Tüketicileri Koruma Yasası', 'Tüketici', ['Tüketicileri Koruma Yasasi']),
    (577, 'TRAFIK', 'Motorlu Araçlar ve Yol Trafik Yasası', 'Trafik', ['MOTORLU ARAÇLAR VE YOL TRAFİK (DEĞİŞİKLİK) YASASI', 'Motorlu Araçlar ve Yol Trafik ( Değişiklik) Yasası', 'Motorlu Araçalr ve Yol Trafik Yasası', 'Motorlu Araçlar ve Yol ve Trafik Yasası']),
    (943, 'CEZAPUANI', 'Yol ve Trafik Suçlarının Davasız Halli ve Ceza Puanı Yasası', 'Trafik', ['YOL VE TRAFİK SUÇLARININ DAVASIZ HALLİ VE CEZA PUANI (DEĞİŞİKLİK) YASASI']),
]

def degisiklikler(basliklar):
    out = set()
    for b in basliklar:
        for it in GRUP.get(b, '').split('|'):
            m = re.match(r'^d0*(\d+)/(\d{4})', it)
            if m: out.add((int(m.group(2)), int(m.group(1))))
    return sorted(out)

yasalar = []
for pkey, kod, ad, alan, basliklar in YASALAR:
    k = kayit[str(pkey)]
    metin = open(os.path.join(REPO, k['metin_dosyasi']), encoding='utf-8').read()
    ms = ayir(metin)
    duz = re.sub(r'\s', '', metin)
    ds = degisiklikler(basliklar)
    kontrol = [{'yasa': f'{n}/{y}', 'metinde': bool(re.search(rf'(?<!\d)0?{n}/{y}', duz))} for y, n in ds if y >= 2005]
    son = [f'{n}/{y}' for y, n in ds][-1] if ds else None
    yasalar.append({
        'kod': kod, 'no': k['numara'], 'ad': ad, 'alan': alan,
        'kaynak': 'KKTC Yüksek Mahkeme mevzuat sistemi — birleştirilmiş resmî metin',
        'url': k['url'], 'sha256': k['sha256'], 'alindi': k['alindi'][:10],
        'son_degisiklik_meclis': son,
        'guncellik_kontrolu': kontrol,
        'maddeler': [{'no': m['no'], 'baslik': m['baslik'], 'metin': m['metin'],
                      'kenar_notu': m['kenar_notu'], 'kaldirildi': m['kaldirildi']} for m in ms],
    })
    print(f"{kod:10} {k['numara']:8} {len(ms):3} madde  son Meclis değişikliği: {son}  "
          f"metinde olmayan: {[c['yasa'] for c in kontrol if not c['metinde']]}")

json.dump({'ad': 'KKTC mevzuatı — ilk dalga (birleştirilmiş resmî metinler)', 'yasalar': yasalar},
          open(os.path.join(os.path.dirname(__file__), 'mevzuat_dalga1.json'), 'w', encoding='utf-8'), ensure_ascii=False)
