"""Kaynak dosyalarda düzenleyici metne yapışık gelen kişisel veri listelerini ve Ek IV sayfalarını ayıklar.

Yüksek Mahkeme sistemindeki bazı taranmış tüzük dosyaları ve Resmî Gazete parçaları, aynı Gazete sayfasındaki
başka ilanları da içerir: Bakanlar Kurulu kararları (Ek IV; politika gereği alınmaz), çek yasağı listeleri, ekli
ad-soyad + kimlik numarası listeleri. Bunlar düzenleyici metnin parçası değildir ve kişisel veri içerir.
Metnin geri kalanı değiştirilmez; kesilen yere ne çıkarıldığını söyleyen açık bir not konur."""
import re

NOT_EK4 = '[Kaynak dosyada bundan sonra gelen Resmî Gazete Ek IV (Bakanlar Kurulu kararları) sayfaları alınmadı.]'
NOT_CEK = '[Kaynak dosyada bundan sonra gelen çek yasağı listesi (kişi adları) alınmadı.]'
NOT_KIMLIK = '[Ek liste alınmadı: kişi adları ve kimlik numaraları içerdiği için (kişisel veri). Tam metin için kaynağa bakınız.]'

EK4 = re.compile(r'(?:\bEK\s*[IiLl1|]\s*V\b[^\n]{0,80}\n?(?:[^\n]{0,80}\n){0,4}?[^\n]{0,40})?BAKANLAR\s+KURULU\s+KARARLAR')
CEK = re.compile(r'Poli\S{0,6}\s*\(?\s*De\S{0,12}\s*\)?\s*Y\s?a\s?s\S*\s+74\s*/\s*C\s+Madde\S*\s+Ta\S{0,6}\s+\S{0,3}ek\s+\S{0,4}ul\S*|Men\s+Edilenler\W{0,3}\S{0,4}\s*(?:Hakk|Ha\S{0,4}da|L[il]s)', re.I)
KIMLIK = re.compile(r"(?m)^[ \t]*(?:\d+\s*[-.)]\s*)?[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü'.]+(?:\s+[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü'.]+){1,3}\s+\d{6,11}\s*$")


def _satir_basi(t, p, geri=400):
    """p'den geriye doğru, aynı Gazete başlığına ait (KUZEY KIBRIS / RESMİ GAZETE / Sayı) satırların başı."""
    lo = max(0, p - geri)
    k = [x for x in re.finditer(r'(?m)^[ \t]*KUZEY\s+KIBRIS', t[lo:p])]
    if k:
        q = lo + k[-1].start()
        s = [x for x in re.finditer(r'(?m)^[ \t]*(?:\[SAYFA|Say[ıi]\s*:?)', t[max(0, q - 120):q])]
        return max(0, q - 120) + s[0].start() if s else q
    m = [x for x in re.finditer(r'(?m)^[ \t]*(?:Say[ıi]\s*:?|\[SAYFA)', t[lo:p])]
    return lo + m[-1].start() if m else (t.rfind('\n', 0, p) + 1)


def ayikla(t, sayac=None):
    """(metin, değişti_mi). Yalnızca metnin ilk 200 karakterinden sonrasına bakar (kendi başlığı korunur)."""
    kes, notu = None, None
    m = EK4.search(t, 200)
    if m: kes, notu = _satir_basi(t, m.start()), NOT_EK4
    c = CEK.search(t, 200)
    if c and (kes is None or c.start() < kes): kes, notu = _satir_basi(t, c.start(), 300), NOT_CEK
    kl = [x for x in KIMLIK.finditer(t, 200)]
    if len(kl) >= 5 and re.search(r'K[İIi]ML[İIil1]K|Kimlik', t[max(0, kl[0].start() - 1500):kl[-1].end()]):
        p = kl[0].start(); bas = t.rfind('[SAYFA', 0, p)
        p = bas if bas > 0 and p - bas < 600 else t.rfind('\n', 0, p) + 1
        if kes is None or p < kes: kes, notu = p, NOT_KIMLIK
    if kes is None or kes < 200: return t, False
    if sayac is not None: sayac[notu[:30]] += 1
    return t[:kes].rstrip() + '\n' + notu, True
