"""rg_bol.py çıktısını depoya kaydeder: veri/resmi-gazete/kayit.json + metin/R<AE>_<yıl>.txt"""
import json, os, re, sys, collections
K = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/rg'
OUT = '/home/claude/kktc-mevzuat-botu/veri/resmi-gazete'
os.makedirs(OUT + '/metin', exist_ok=True)
o = json.load(open(os.path.join(K, 'rg_maddeler.json'), encoding='utf-8'))
def bozuk(t):
    w = re.findall(r'\S+', t)
    kotu = sum(1 for x in w if re.search(r'[~·•|\\{}<>^¡¿]|[a-zçğıöşü][A-ZÇĞİÖŞÜ]{2}|\d[a-zçğıöşü]{2,}\d', x))
    return kotu / max(1, len(w))
kay, gor, ist = [], set(), collections.Counter()
# görüntü sayfaları yazı tanıma ile okunan sayılar (rg_ocr.py): bu sayılardan alınan metinler 'ocr' işaretlenir
_of = os.path.join(K, 'ocr_yapildi.json')
OCRLI = set(json.load(open(_of))) if os.path.exists(_of) else set()
for x in o:
    if not x['metin'] or len(x['metin']) < 150 or x['ae'] in gor: ist['atlandı'] += 1; continue
    gor.add(x['ae'])
    ad = 'R' + x['ae'].replace('/', '_') + '.txt'
    open(os.path.join(OUT, 'metin', ad), 'w', encoding='utf-8').write(x['metin'])
    b = bozuk(x['metin'])
    kay.append({'ae': x['ae'], 'tur': x['tur'], 'baslik': x['baslik'], 'yil': x['yil'], 'sayi': x['sayi'], 'tarih': x['tarih'],
                'url': 'https://' + ('arsiv.basimevi.gov.ct.tr' if '/Portals/105/' in x['u'] else 'basimevi.gov.ct.tr') + re.sub(r'\?.*', '', x['u']),
                'metin_dosyasi': 'veri/resmi-gazete/metin/' + ad, 'eslesme_puani': x['puan'], 'ocr': b > 0.02 or re.sub(r'\?.*', '', x['u']) in OCRLI, 'bozukluk': round(b, 4)})
    ist[x['tur']] += 1; ist['ocr'] += b > 0.02 or re.sub(r'\?.*', '', x['u']) in OCRLI
# önceki kayıtta olup bu turda eşleşmeyen maddeler (bölme değişikliği) korunur: metin dosyası yerinde kalır
_ok = os.path.join(OUT, 'kayit.json')
if os.path.exists(_ok):
    for x in json.load(open(_ok, encoding='utf-8'))['kayitlar']:
        if x['ae'] not in gor and os.path.exists(os.path.join('/home/claude/kktc-mevzuat-botu', x['metin_dosyasi'])):
            kay.append(x); gor.add(x['ae']); ist['önceki kayıttan korundu'] += 1
json.dump({'kaynak': 'KKTC Resmî Gazete — Devlet Basımevi arşivi (basimevi.gov.ct.tr, arsiv.basimevi.gov.ct.tr)', 'alindi': '2026-10-12',
           'not': 'Ek III\'te yayımlanan ve Yüksek Mahkeme mevzuat sisteminde bulunmayan tüzük, emirname, yönetmelik ve tebliğler. Metin, Gazete PDF\'inin metin katmanından alınmış ve Basımevi dizinindeki başlıkla eşleştirilerek ayrılmıştır; değiştirilmemiştir.',
           'kayitlar': kay}, open(os.path.join(OUT, 'kayit.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(dict(ist))
