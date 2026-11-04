"""onar.py'nin sözcük birleştirme adımı için sözlük: yalnızca temiz kaynaklardan (Yüksek Mahkeme'nin metin
tabanlı PDF/Word dosyaları; yazı tanıma ve Resmî Gazete taramaları hariç). Mahkeme kararları isteğe bağlıdır (--kararlar).

Kullanım: python3 sozluk_kur.py [app/pub] [çıktı=onar_sozluk.json] [--kararlar]

DİKKAT: sözlüğü yeniden kurmak onar.py çıktısını (sözcük birleştirme, büyük harf, ş/ğ/f onarımı) ve ikili okumanın
seçimlerini değiştirir; ikili_okuma.json'daki düzeltmeler metnin md5'ine bağlı olduğu için eski düzeltmeler uygulanmaz
olur. Yeni sözlükten sonra: IKILI=0 derleme → rg_dogrula.py → ikili_okuma.py → derleme, önce/sonra karşılaştırma
(kaybolan düzeltme 0) ve örneklem denetimi (ikili_olcum.md) yapılmalıdır.

--kararlar ölçümü (4 Kasım 2026, YAPILACAKLAR.md): kararlar eklenince sözlük 45.578 → 118.740 sözcük; ikili okuma
4.410 → 5.042 kelime grubu, AMA 45 tüzükteki eski düzeltmeler kayboluyor (kararlardaki Türkçe karaktersiz/yanlış
yazımlar 'Kibris', 'uyarinca', 'süretiyle' sözlükte "geçerli" sayılıyor) ve kısa parçaların sıklığı arttığı için
sözcük birleştirme geriliyor ('yapabilir.' → 'yapabi li r.'). Bu yüzden kararlar varsayılan olarak alınmaz.
(Eski sürümde kararlar okunmak isteniyordu ama paket biçimi {karar no: metin} olduğundan hiç sayılmıyordu.)"""
import json, glob, re, collections, sys, os
argv = [a for a in sys.argv[1:] if not a.startswith('--')]
KARARLAR = '--kararlar' in sys.argv
pub = argv[0] if len(argv) > 0 else 'app/pub'
cikti = argv[1] if len(argv) > 1 else 'onar_sozluk.json'
def kucuk(w): return w.replace('I', 'ı').replace('İ', 'i').lower()
SOZCUK = r'[A-Za-zÇĞİÖŞÜçğıöşüâîû]+'
def yazi_tipi_hatali(t): return len(re.findall(r'[a-zçöüı][ŞĞ][a-zçöüı]', t)) >= 2
def ingilizce(t):  # build_tum.py ile aynı ölçüt
    o = ' ' + t[:20000].lower() + ' '
    return o.count(' the ') + o.count(' of ') > 3 * (o.count(' ve ') + o.count(' bir ') + 1)
dz = json.load(open(os.path.join(pub, 'tum-dizin.json')))['yasalar']
temiz = {x['p'] for x in dz if not x.get('o') and not x.get('ks') and not x.get('en') and x.get('k') in ('pdf', 'libreoffice', 'docx', 'doc', 'elle', 'dogrudan-hmut')}
c = collections.Counter()
for f in glob.glob(os.path.join(pub, 'tum-*.json')):
    if 'dizin' in f: continue
    for k, ms in json.load(open(f)).items():
        if k in temiz:
            for m in ms:
                if yazi_tipi_hatali(m.get('metin', '')): continue
                c.update(kucuk(w) for w in re.findall(SOZCUK, m.get('metin', '')))
kn = 0
if KARARLAR:
    # İngilizce kararlar alınmaz; bir sözcüğün sayılması için en az iki ayrı kararda geçmesi gerekir
    kc, kdf = collections.Counter(), collections.Counter()
    for f in glob.glob(os.path.join(pub, 'karar-p*.json')):
        d = json.load(open(f)); it = d.values() if isinstance(d, dict) else d
        for m in it:
            for x in (m if isinstance(m, list) else [m]):
                t = x if isinstance(x, str) else (x.get('metin') or x.get('text') or '') if isinstance(x, dict) else ''
                if not t or yazi_tipi_hatali(t) or ingilizce(t): continue
                ws = [kucuk(w) for w in re.findall(SOZCUK, t)]
                kc.update(ws); kdf.update(set(ws)); kn += 1
    c.update({w: n for w, n in kc.items() if kdf[w] >= 2})
s = {w: n for w, n in c.items() if n >= 3 and len(w) >= 2}
json.dump(s, open(cikti, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(temiz), 'temiz metin;', (str(kn) + ' Türkçe karar; ') if KARARLAR else '', len(s), 'sözcük →', cikti)
