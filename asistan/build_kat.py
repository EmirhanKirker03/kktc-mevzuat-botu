"""Kat Mülkiyeti ve Kat İrtifakı Yasası (35/2010) — Meclis arşivindeki esas metin + 40/2024 ve 49/2026 değişiklikleri.

Yüksek Mahkeme sistemindeki dosya yalnızca içdüzeni içerdiği için metin Meclis arşivinden alındı.
Word dosyasında tablo sütunları birbirine karıştığı için madde başlıkları içdüzeninden alınır ve
gövdeye karışan kenar başlığı parçaları ile kenar notu (yasa numarası) listeleri ayıklanır.
Kelimeler değiştirilmez; yalnızca bu düzen artıkları çıkarılır.
"""
import re, json, hashlib, os

D = os.path.dirname(__file__)
t = open(os.path.join(D, 'raw/kat/35-2010_temiz.txt'), encoding='utf-8').read()
a40 = open(os.path.join(D, 'raw/kat/a40_2024.txt'), encoding='utf-8').read()
a49 = open(os.path.join(D, 'raw/kat/a49_2026.txt'), encoding='utf-8').read()
govde, _, ic = t.partition('KAT MÜLKİYETİ VE KAT İRTİFAKI YASASI\nİÇDÜZENİ')

BASLIK = {k: v.strip() for k, v in re.findall(r'(?<!Geçici )Madde\s*(\d+)\.\s*([^\n]+?)(?=(?:Geçici )?Madde\s*\d+\.|\n|$)', ic)}
BASLIK.update({'52': 'Tüzük Yapma Yetkisi', '53': 'Yürürlükten Kaldırma', '54': 'Yürütme Yetkisi', '55': 'Yürürlüğe Giriş'})
GECICI_BASLIK = re.search(r'Geçici Madde 1\.(.+)$', ic).group(1).strip()
NOT_RE = re.compile(r'(?:Fasıl\s*\d+\s*)?(?:\s*\n?\s*\d{1,3}/\d{4}){2,}\s*|Fasıl\s*\d+\s*(?=\n)|(?<=\D)\d{1,3}/\d{4}(?=\d{1,2}\.\s)')

def norm(s): return re.sub(r'[\s\-]+', '', s).lower()

# madde başlangıçlarını sırayla bul
bas = []
cur = govde.index('Kısa İsim1.')
for n in list(range(1, 52)) + ['G1'] + list(range(52, 56)):
    if n == 'G1':
        m = re.search(r'Kaydedilmesi(1)\.\s', govde[cur:]); s, e = cur + m.start(1), cur + m.end()
    else:
        m = re.compile(r'(?:(?<![\d/(])|(?<=/\d{4}))' + str(n) + r'\.\s?(?=\(1\)|[A-ZÇĞİÖŞÜ“])').search(govde, cur)
        s, e = m.start(), m.end()
    bas.append((str(n), s, e)); cur = e

def baslik_on_eki(onceki_bitis, sayi_bas, baslik):
    """Numaradan hemen önceki, başlığın başı olan metni bul (kenar sütunu artığı)."""
    pencere = govde[max(onceki_bitis, sayi_bas - 400):sayi_bas]
    temiz_baslik = norm(baslik)
    en_iyi = 0
    for k in range(1, len(pencere) + 1):
        aday = norm(re.sub(r'\d{1,3}/\d{4}|Fasıl\s*\d+', '', NOT_RE.sub('', pencere[-k:])))
        if aday and temiz_baslik.startswith(aday): en_iyi = k
        elif aday and not aday.startswith('geçicimadde') and len(aday) > len(temiz_baslik) + 40: break
    return en_iyi

maddeler = []
for i, (n, s, e) in enumerate(bas):
    baslik = GECICI_BASLIK if n == 'G1' else BASLIK.get(n, '')
    sonraki = bas[i + 1] if i + 1 < len(bas) else None
    if sonraki:
        sb = GECICI_BASLIK if sonraki[0] == 'G1' else BASLIK.get(sonraki[0], '')
        k = baslik_on_eki(e, sonraki[1], ('Geçici Madde ' if sonraki[0] == 'G1' else '') + sb)
        bit = sonraki[1] - k
    else:
        bit = len(govde)
    g = govde[e:bit]
    # gövdeye karışmış kenar başlığı parçalarını çıkar (başlığın numaradan önce yazılmamış kısmı)
    onek_k = baslik_on_eki(bas[i - 1][2] if i else 0, s, ('Geçici Madde ' if n == 'G1' else '') + baslik)
    yazilan = norm(NOT_RE.sub('', govde[s - onek_k:s]))
    kalan = baslik
    while kalan and norm(kalan[:1]) and yazilan and norm(kalan).startswith(yazilan[:1]):
        # yazılan kısmı başlıktan düş
        w = kalan.split(); acc = ''
        while w and len(norm(acc)) < len(yazilan): acc += w.pop(0) + ' '
        kalan = ' '.join(w); break
    kelimeler = kalan.split()
    while kelimeler:
        bulundu = False
        for L in range(len(kelimeler), 0, -1):
            parca = r'\s*'.join(re.escape(x) for x in kelimeler[:L])
            m = re.search(r'(?:(?<=[.:;,)])|(?<=\n)|^)\s*' + parca + r'\s*(?=\(|\n|$)', g)
            if m:
                g = g[:m.start()] + ('\n' if '\n' in m.group(0) else '') + g[m.end():]
                kelimeler = kelimeler[L:]; bulundu = True; break
        if not bulundu: break
    notlar = sorted(set(re.findall(r'\d{1,3}/\d{4}', ''.join(re.findall(r'(?:\n\s*\d{1,3}/\d{4}){2,}', g)))))
    g = NOT_RE.sub(' ', g)
    g = re.sub(r'\s*(?:BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ|ALTINCI|YEDİNCİ|SEKİZİNCİ|DOKUZUNCU)\s*KISIM[\s\S]*$', '', g)
    g = re.sub(r'(?:\s*\d{1,3}/\d{4})+\s*$', '', g)
    g = re.sub(r'(?<=[.:;])(?=\((?:\d{1,2}|[A-ZÇĞİÖŞÜ])\))', '\n', g)   # fıkra/bent başlarını satıra al
    g = re.sub(r'[ \t]+', ' ', g); g = re.sub(r'\s*\n\s*', '\n', g).strip()
    maddeler.append({'no': 'Geçici 1' if n == 'G1' else n, 'baslik': baslik, 'metin': g, 'kenar_notu': notlar, 'kaldirildi': False})

def kes(metin, bas_, bit_):
    i = metin.index(bas_); j = metin.index(bit_, i) + len(bit_)
    return re.sub(r'\n{2,}', '\n', metin[i:j]).strip()

M = {m['no']: m for m in maddeler}
M['12']['amendments'] = [
    {'law': '40/2024 Kat Mülkiyeti ve Kat İrtifakı (Değişiklik) Yasası',
     'change': '12(1) kaldırıldı, yerine yeni (1) kondu: (A) kat mülkiyeti ve kat irtifakı tapu siciline çıkarılan koçanın tescili ile doğar; (B) satış/devir için müstakil tapu veya kat irtifakı zorunlu. Ayrıca yeni (7) ve (8) fıkraları eklendi.',
     'new_text': kes(a40, '“(1)', 'geçersiz sayılır.”') + '\n' + kes(a40, '“(7)', 'çarptırılabilir.”')},
    {'law': '49/2026 Kat Mülkiyeti ve Kat İrtifakı (Değişiklik) Yasası',
     'change': '12(1)(B) yeniden yazıldı: alıcı KKTC yurttaşı ise müstakil tapu/kat irtifakı şartı uygulanmaz. 12(8) yeniden yazıldı (suç ve para cezası).',
     'new_text': kes(a49, '“(B)', 'bu kural uygulanmaz. ”') + '\n' + kes(a49, '“(8)', 'çarptırılabilir.”')},
]
M['12']['durum_notu'] = 'yürürlükte (40/2024 ve 49/2026 ile değişik)'

H = lambda s: hashlib.sha256(s.encode()).hexdigest()
yasa = {
    'kod': 'KAT', 'no': '35/2010', 'ad': 'Kat Mülkiyeti ve Kat İrtifakı Yasası', 'alan': 'Kat Mülkiyeti',
    'kaynak': 'KKTC Cumhuriyet Meclisi arşivi — esas metin + değişiklik yasaları (birleştirilmiş resmî metin bulunamadı)',
    'url': 'http://cm.gov.ct.tr/Yasalar/35-2010.doc', 'alindi': '2026-10-09',
    'sha256': {'35/2010 (çıkarılan metin, ikili artık temizlenmeden)': '3b0d73b83f3dab6c287f053df6de89e6793b1dffe17ebf9dd3525378249e822e',
               '35/2010 (temizlenmiş)': H(t), '40/2024': H(a40), '49/2026': H(a49)},
    'son_degisiklik_meclis': '49/2026',
    'guncellik_kontrolu': [{'yasa': '40/2024', 'metinde': True}, {'yasa': '49/2026', 'metinde': True}],
    'ayri_degisiklik': True,
    'maddeler': maddeler,
}
json.dump(yasa, open(os.path.join(D, 'mevzuat_kat.json'), 'w', encoding='utf-8'), ensure_ascii=False)
for m in maddeler:
    print(f"{m['no']:>9} | {m['baslik'][:50]:50} | {len(m['metin']):5} | {m['metin'][:60]!r} ... {m['metin'][-40:]!r}")
