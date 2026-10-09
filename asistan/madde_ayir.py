"""KKTC birleştirilmiş yasa metinlerini maddelere ayırır.

Resmî metinlerde her madde genellikle "<kenar başlığı>\\t<no>.\\t<metin>" biçimindedir.
Kenar sütununda madde başlığı ya da değiştiren yasa notu (ör. "27/2011") bulunur.
Metin değiştirilmez; yalnızca maddelere bölünür. Ayrılamayan metin "ayrilamadi" olarak işaretlenir.
"""
import re

NUM = r'[0-9lIİ]{1,3}'
SATIR = re.compile(r'^(?P<kenar>[^\t\n]{0,220}?)\t+\s*(?P<no>' + NUM + r')(?P<harf>[A-Z]?)(?:\s*\.\s*(?:\t|\s+(?=\S))|\t+(?=\S))(?P<govde>.*)$')
YASA_NOTU = re.compile(r'\b\d{1,3}\s*/\s*\d{2,4}\b|Fasıl\s*\d+|Bölüm\s*\d+', re.I)

def no_coz(s):
    return int(s.replace('l', '1').replace('I', '1').replace('İ', '1'))

def baslik_mi(s):
    s = s.strip()
    if not s or len(s) > 160: return False
    if YASA_NOTU.fullmatch(s.replace(' ', '')) or re.fullmatch(r'[\d/\s,.;ve-]+', s): return False
    return bool(re.search(r'[A-Za-zÇĞİÖŞÜçğıöşü]{3,}', s))

def ayir(metin):
    satirlar = metin.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    adaylar = []
    for i, s in enumerate(satirlar):
        m = SATIR.match(s)
        if m:
            adaylar.append((i, m.group('kenar').strip(), no_coz(m.group('no')), m.group('govde'), m.group('harf')))
    maddeler, son, gecici = [], 0, False
    for i, kenar, no, govde, harf in adaylar:
        g = 'geçici' in kenar.lower() or 'gecici' in kenar.lower()
        if not g and no == 1 and son >= 5:
            g = True  # numara 1'e döndü: geçici maddeler (kenar başlığı OCR'da kaybolmuş olabilir)
        if g and not gecici:
            gecici, son = True, 0
        if gecici and not g and no > son + 3:
            gecici = False  # geçici maddelerden sonra kalıcı numaraya dönüş (ör. 18. Yürürlüğe giriş)
            son = max((m['no_int'] for m in maddeler if not m['gecici']), default=0)
        ek = ''
        if gecici and no == 1 and son >= 1:
            yn = YASA_NOTU.findall(kenar)
            if not yn: continue
            son, ek = 0, ' (' + yn[-1].replace(' ', '') + ')'   # değişiklik yasasının kendi geçici maddesi
        if harf and no == son and maddeler:
            pass  # 4A gibi ara madde
        elif not (son < no <= son + 5):
            continue  # alt bent veya yanlış eşleşme
        # kenar sütunu: aynı satırdaki metin + hemen üstteki, sekmeyle başlamayan kısa satırlar
        ust = []
        j = i - 1
        while j >= 0 and i - j <= 60:
            ham = satirlar[j]; t = ham.strip()
            if not t: j -= 1; continue
            if ham.startswith('\t') or '\t' in t or len(t) > 160 or SATIR.match(ham): break
            ust.append(t); j -= 1
        ust.reverse()
        kenar_tum = ust + ([kenar] if kenar else [])
        # KISIM başlığı ve hemen altındaki bölüm adı madde başlığı değildir
        temiz, atla = [], False
        for x in kenar_tum:
            if x.upper() == x and re.search(r'KISIM|BÖLÜM|BAŞLANGIÇ|KURALLAR', x): atla = True; temiz = []; continue
            if atla: atla = False; continue
            temiz.append(x)
        parcalar = [x for x in temiz if baslik_mi(x) and not x.lower().startswith(('sayı', 'cetvel', 'ek.', 'rg'))]
        baslik = re.sub(r'\s+', ' ', ' '.join(parcalar)).strip()
        baslik = re.sub(r'(\w)-\s+(\w)', r'\1\2', baslik)
        if len(baslik) > 140: baslik = parcalar[-1] if parcalar else ''
        kenar = ' '.join(kenar_tum)
        notlar = YASA_NOTU.findall(kenar)
        maddeler.append({'satir': i, 'no_int': no, 'gecici': gecici,
                         'no': ('Geçici ' if gecici else '') + str(no) + (harf or '') + ek, 'baslik': baslik.rstrip('.').strip(),
                         'kenar_notu': notlar})
        son = no
    # gövdeleri satır aralıklarından kes
    for k, m in enumerate(maddeler):
        bas = m['satir']; bit = maddeler[k + 1]['satir'] if k + 1 < len(maddeler) else len(satirlar)
        govde = '\n'.join(satirlar[bas:bit])
        govde = SATIR.sub(lambda x: x.group('govde'), govde, count=1)
        # sonraki maddenin kenar başlığı bu gövdenin son satırına düşmüş olabilir
        if k + 1 < len(maddeler) and maddeler[k + 1]['baslik']:
            govde = re.sub(re.escape(maddeler[k + 1]['baslik']) + r'\.?\s*$', '', govde.rstrip())
        m['metin'] = re.sub(r'\n{3,}', '\n\n', re.sub(r'[ \t]+', ' ', govde)).strip()
        m['kaldirildi'] = bool(re.search(r'yürürlükten kaldırıl(mıştır|ır|dı)', m['metin'][:200], re.I))
        del m['satir']
    return maddeler

if __name__ == '__main__':
    import sys, json
    t = open(sys.argv[1], encoding='utf-8').read()
    ms = ayir(t)
    for m in ms:
        print(f"{m['no']:>10} | {m['baslik'][:45]:45} | {len(m['metin']):5} | {','.join(m['kenar_notu'])} {'KALDIRILDI' if m['kaldirildi'] else ''}")
    print(len(ms), 'madde')
