"""Resmî Gazete sayılarının metninden hedef maddeleri (tüzük, emirname, yönetmelik, tebliğ) ayırır.
Girdi: rg_hedef_ham.json (Basımevi dizini: sayı, tarih, A.E. no, başlık), metin/<portal>_<yıl>_<sayı>.pdf.txt
Çıktı: rg_maddeler.json — her hedef için bulunan metin parçası ve eşleşme puanı. Metin değiştirilmez (yalnızca fazla boşluk)."""
import json, re, os, sys, collections, difflib
def _duz(x): return re.sub(r'[^a-z]', '', x.replace('İ', 'i').replace('I', 'i').lower().translate(str.maketrans('çğıöşü', 'cgiosu')))
K = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/rg'
TR = str.maketrans('çğıöşüâîûÇĞİÖŞÜÂÎÛI', 'cgiosuaiuCGIOSUAIUI')
STOP = set('ve ile yasasi yasa tuzugu tuzuk degisiklik emirnamesi emirname yonetmeligi hakkinda iliskin bu ait'.split())
def toks(s): return {w[:6] for w in re.sub(r'[^a-z0-9 ]+', ' ', s.replace('İ', 'i').replace('I', 'ı').lower().translate(TR)).split() if len(w) > 2 and w not in STOP}
def buyuk(sat):
    h = [c for c in sat if c.isalpha()]
    return len(h) >= 6 and sum(1 for c in h if c.isupper()) / len(h) > 0.8
YAPAR = re.compile(r'aşağıdaki[^\n]{0,60}(?:\n[^\n]{0,30})?\b[Yy]apar\b|a[şs]a[ğg][ıi]daki\s+\S*\s*(?:T[üu]z[üu][ğg][üu]|Emirname\S*|Y[öo]netmeli\S*)\s+yapar', re.I)
BASLIK_CAPA = set()
def bolumler(t):
    BASLIK_CAPA.clear()
    t = re.sub(r'[ \t]+', ' ', t)
    sat = t.split('\n'); konum = [0]
    for x in sat: konum.append(konum[-1] + len(x) + 1)
    starts = []
    capalar = [m.start() for m in YAPAR.finditer(t)]
    # 'yapar' cümlesi okunamadıysa: '1. Bu Tüzük/Emirname ... olarak isimlendirilir' kısa isim maddesi
    for m in re.finditer(r'\b1\s*\.\s*Bu\s+(?:T[üu]z[üu]k|Emirname|Y[öo]netmelik|Tebli[ğg])\b', t):
        if not any(0 <= m.start() - c < 1500 for c in capalar): capalar.append(m.start())
    for c in sorted(capalar):
        m = re.match('', t[c:]); m_start = c
        i = t.count('\n', 0, m_start); j = i - 1; bas = i; bos = 0
        # başlık: yapar cümlesinin üstündeki büyük harfli satırlar (kenar notları araya girebilir)
        while j >= 0 and i - j < 40:
            s = sat[j].strip()
            if not s or s.startswith('[SAYFA'): j -= 1; continue
            if buyuk(s): bas = j; bos = 0
            else:
                bos += 1
                if bos > 12 and bas < i: break
            if re.match(r'^(Sayı|SAYI)\s*:', s) and bas < i: break
            j -= 1
        starts.append(konum[bas])
    # ek çapa: Ek III'te her metnin başındaki dayanak yasa başlığı ("BELEDİYELER YASASI" + altında "(51/1995, ...)" satırı);
    # 'yapar' cümlesi yazı tanımada bozulduğunda art arda gelen tüzükler tek parçada kalmasın
    for j in range(len(sat) - 1):
        s0 = sat[j].strip()
        if re.fullmatch(r"[A-ZÇĞİÖŞÜ0-9 ().,'’\-]{3,}YA\s?SAS\s?[IİlıL1]\s*", s0) and re.match(r'^\s*\(\s*(?:\d|Fas[ıi]l|FASIL)', sat[j + 1]):
            p = konum[j]
            if not any(abs(p - x) < 600 for x in starts): starts.append(p); BASLIK_CAPA.add(p)
    starts = sorted(set(starts))
    return t, [(a, starts[k + 1] if k + 1 < len(starts) else len(t)) for k, a in enumerate(starts)]
def kirp(seg):
    m = re.search(r'\n\s*EK\s*IV\b|\n\s*Say[ıi]\s*:?\s*\S{1,4}\s*(?:EK)?\s*-?\s*IV\b|\n\s*EK\s*VI?\b\s*\n', seg[200:])
    c = 200 + m.start() if m else len(seg)
    # Ek IV (Bakanlar Kurulu kararları) başlığı OCR'da bozulmuş olabilir: "BAKANLAR KURULU KARARLARI" bölüm başlığından önceki Sayı satırında kes
    b = re.search(r'BAKANLAR\s+KURULU\s+KARARLAR|Bakanlar\s+Kurulu\s+Kararlar[ıi]\s*\)', seg[200:c])
    if b:
        p = 200 + b.start(); onc = [x for x in re.finditer(r'(?m)^[ \t]*Say[ıi]', seg[max(200, p - 300):p])]
        c = max(200, p - 300) + onc[0].start() if onc else seg.rfind('\n', 0, p) + 1
    return seg[:c]

# Bir metnin sonuna aynı sayıdaki sonraki ilanlar (Merkez Bankası duyurusu, vaziyet, çek yasağı listeleri vb.) taşmasın:
# kendi A.E. numarasından sonra gelen ilk "Sayı : N" satırında (0 < N-kendi <= 20) kesilir. Kesilecek kısımda, bir sonraki
# isim/yapar cümlesine kadar yürürlük cümlesi varsa (sayfa sırası karışmış, metin devam ediyor) o satırda kesilmez.
SAYI_SATIR = re.compile(r'(?m)^[ \t]*Say[ıi]\s*:?\s*0*(\d+)\b(?![.,/]\d)(?![ \t]+\d{1,2}[ \t]+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+[ \t,]+\d{4})')
YURURLUK = re.compile(r"y[üu]\s?r[üu]\s?rl[üu]\s?[ğg]e|yürürlüğe|y[üu]r[üu]rl[üu]kten\s+kalk|Gazete.{0,3}de\s+yay|yay[ıi]m?[lJ]and[ıi]?[ğg][ıi]\s+tarihten", re.I)
ISIM_CUMLE = re.compile(r'isimlendiril|olarak\s+an[ıi]l|a[şs]a[ğg][ıi]daki\s+\S+\s+yapar', re.I)
# Kişi adları içeren listeler (çek yasağı listesi) hiçbir düzenleyici metnin parçası değildir: başladığı yerden kesilir.
KISI_LISTE = re.compile(r'(?:Say[ıi]\s*:?\s*\d+\s*)?Poli[çc]eler\s*\(\s*De[ğg]i[şs]iklik\s*\)\s*Y\s?a\s?s\S*\s+74\s*/\s*C', re.I)
KISI_BASLIK = re.compile(r'(?m)^.{0,80}?\b\S{0,3}Poli\S{0,6}\s*\(?\s*\S{0,14}\s*\)?\s*\S*\s*74\s*/\s*C\b|Men\s+Edilenler\W{0,3}\S{0,4}\s*(?:Hakk|Ha\S{0,4}da|L[il]s)', re.I)
def sonraki_kes(m, own, sayi):
    x = KISI_LISTE.search(m, 150) or KISI_BASLIK.search(m, 150)
    if x:
        h = x.start(); onc = [y for y in re.finditer(r'(?m)^[ \t]*Say[ıi]\S{0,2}\s*:?\s*\d+', m[max(150, h - 300):h])]
        c = h
        if re.match(r'Say', m[h:h + 3]): pass
        elif onc: c = max(150, h - 300) + onc[-1].start()
        else:  # liste satırları (ad-soyad) başlıktan önce basılmışsa: kendi metninin son yürürlük cümlesinden sonra kes
            yy = [y for y in YURURLUK.finditer(m, max(150, h - 2500), h)]
            if yy:
                n = m.find('.', yy[-1].end(), h); n = n + 1 if n > 0 else h
                if re.search(r'(?m)AD[Iİ]\s*-?\s*SOYAD|^\s*\d+\s*-\s*[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+', m[n:h]): c = n
        m = m[:c].rstrip()
    for x in SAYI_SATIR.finditer(m):
        k, p = int(x.group(1)), x.start()
        if p < 150 or str(k) == str(sayi) or not (0 < k - own <= 20): continue
        n = ISIM_CUMLE.search(m, p)
        if YURURLUK.search(m[p:n.start() if n else len(m)]): continue
        return m[:p].rstrip()
    return m
def kendi_basi(t, a, own, onceki):
    """Bölüm 'yapar'/'1. Bu ...' cümlesinden başlıyorsa, hemen öncesindeki kendi "Sayı : <A.E.>" satırından itibaren al
    (fiyat tablosu, dayanak yasa başlığı gibi önce basılmış kısımlar kaybolmasın). Aradaki kısımda başka bir metnin
    sonu (yürürlük cümlesi) ya da başka bir Sayı satırı varsa genişletilmez."""
    lo = max(onceki, a - 3000)
    ms = [x for x in SAYI_SATIR.finditer(t, lo, a)]
    if not ms or int(ms[-1].group(1)) != own: return a
    s = ms[-1].start()
    if YURURLUK.search(t[s:a]) or ISIM_CUMLE.search(t[s:a]): return a
    return s
hedef = json.load(open(os.path.join(K, 'rg_hedef_ham.json'), encoding='utf-8'))
sayilar = collections.defaultdict(list)
for tur, l in hedef.items():
    for z in l: sayilar[re.sub(r'\?.*', '', z['u'])].append(dict(z, tur=tur))
out, ist = [], collections.Counter()
for u, its in sayilar.items():
    f = os.path.join(K, 'metin', re.sub(r'^/Portals/', '', u).replace('/', '_') + '.txt')
    if not os.path.exists(f): ist['metin yok'] += len(its); continue
    t, segs = bolumler(open(f, encoding='utf-8').read())
    puanlar = []
    for zi, z in enumerate(its):
        bt = toks(re.sub(r'^.*?YASASI\s*[-–]\s*', '', z['baslik'])) or toks(z['baslik'])
        for k, (a, b) in enumerate(segs):
            bas = toks(t[a:min(b, a + 900)])
            ism = re.search(r'Bu\s+(?:T[üu]z[üu]k|Emirname|Y[öo]netmelik|Tebli[ğg])\s*,?([\s\S]{0,400}?)(?:isimlendiril|olarak an[ıi]l)', t[a:min(b, a + 4000)])
            if ism: bas |= toks(ism.group(1))
            p = len(bt & bas) / max(1, len(bt))
            # sıralamada küçük öncelik: bölümün ilk satırı hedefin dayanak yasasının adıysa (aynı sayıda iç içe geçmiş metinler)
            # bölüm başka bir dayanak yasanın başlığıyla başlıyorsa (ör. ZORLA MAL İKTİSABI YASASI) bu hedefe verilmez
            # bölümün kendi metni hedefin adından hiçbir şey içermiyorsa (eşleşme yalnızca sonraki metinden) verilmez
            if p >= 0.6 and len(bt & toks(t[a:min(b, a + 3000)])) < 0.3 * len(bt): p = 0
            puanlar.append((p, zi, k))
    # açgözlü bire-bir atama: her bölüm en fazla bir maddeye, en yüksek puandan başlayarak (aynı sayıdaki benzer adlı emirnameler karışmasın)
    # sonradan eklenen hedefler ('ek': eksik tüzükler) ikinci turda atanır: önceki eşleşmeler değişmez
    atandi, kullan = {}, set()
    for tur_ in (False, True):
        for p, zi, k in sorted(puanlar, reverse=True):
            if bool(its[zi].get('ek')) != tur_ or p < 0.6 or zi in atandi or k in kullan: continue
            atandi[zi] = (k, p); kullan.add(k)
    # üçüncü tur: eşleşmeyen hedefler için A.E. numarası çapası (Ek III'te her metin "Sayı : <A.E. no>" satırıyla başlar).
    # Yalnızca hiçbir hedefe verilmemiş bölgelerde (ilk çapadan önceki kısım ve kullanılmamış bölümler) aranır:
    # önceki eşleşmeler ve metinleri değişmez.
    # dolu bölgeler: atanan bölümlerin taşma kesildikten sonraki gerçek uzunluğu (kesilen kuyruk başka bir metnindir)
    dolu = []
    for zi_, (k, _) in atandi.items():
        a_, b_ = segs[k]
        ham = t[a_:b_]; kesik = sonraki_kes(ham, int(its[zi_]['ae'].split('/')[0]), its[zi_].get('sayi'))
        dolu.append((a_, a_ + len(kesik) if len(kesik) < len(ham.rstrip()) else b_))
    sinir = sorted({a for a, _ in segs} | {len(t)})
    ek_parca, alinan = {}, set()
    for zi, z in enumerate(its):
        if zi in atandi: continue
        no = z['ae'].split('/')[0]
        bt = toks(re.sub(r'^.*?YASASI\s*[-–]\s*', '', z['baslik'])) or toks(z['baslik'])
        for m in re.finditer(r'(?m)^[ \t]*Say[ıi]\s*:\s*0*' + no + r'\b(?![.,/]\d)(?![ \t]+\d{1,2}[ \t]+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+[ \t,]+\d{4})', t):
            a = m.start()
            if a in alinan or any(x <= a < y for x, y in dolu): continue
            # Ek IV (Bakanlar Kurulu kararları) kendi numaralarını kullanır; oradaki "Sayı : N" satırı alınmaz
            if re.search(r'\bEK\s*IV\b|BAKANLAR\s+KURULU\s+KARARLARI', t[a:a + 400]): continue
            b = min([s for s in sinir if s > a] or [len(t)])
            for n in re.finditer(r'(?m)^[ \t]*Say[ıi]\s*:\s*0*(\d+)\b', t[a + 1:b]):
                if n.group(1) not in (no, z.get('sayi')): b = a + 1 + n.start(); break
            bas = toks(t[a:min(b, a + 900)])
            ism = re.search(r'Bu\s+(?:T[üu]z[üu]k|Emirname|Y[öo]netmelik|Tebli[ğg])\s*,?([\s\S]{0,400}?)(?:isimlendiril|olarak an[ıi]l)', t[a:min(b, a + 4000)])
            if ism: bas |= toks(ism.group(1))
            p = len(bt & bas) / max(1, len(bt))
            if p < 0.6 or len(bt & toks(kirp(t[a:b])[:3000])) < 0.3 * len(bt): continue
            ek_parca[zi] = (a, b, p); alinan.add(a); break
    for zi, z in enumerate(its):
        if zi in ek_parca:
            a, b, p = ek_parca[zi]
            ist['eşleşti'] += 1; ist[z['tur']] += 1; ist['eşleşti (A.E. çapası)'] += 1
            out.append(dict(z, metin=sonraki_kes(kirp(t[a:b]).strip(), int(z['ae'].split('/')[0]), z.get('sayi')), puan=round(p, 2)))
        elif zi in atandi:
            k, p = atandi[zi]; a, b = segs[k]
            own = int(z['ae'].split('/')[0])
            a2 = kendi_basi(t, a, own, max([y for _, y in segs if y <= a] + [x for x, _ in segs if x < a] + [0]))
            mt = sonraki_kes(kirp(t[a2:b]).strip(), own, z.get('sayi'))
            bt = toks(re.sub(r'^.*?YASASI\s*[-–]\s*', '', z['baslik'])) or toks(z['baslik'])
            if (a in BASLIK_CAPA or b in BASLIK_CAPA) and len(bt & toks(mt[:3000])) < 0.3 * len(bt):  # yeni başlık çapası, kırpılmış metinde hedefin adı yok: yanlış parça verilmesin
                ist['eşleşmedi'] += 1; out.append(dict(z, metin='', puan=round(p, 2))); continue
            ist['eşleşti'] += 1; ist[z['tur']] += 1
            out.append(dict(z, metin=mt, puan=round(p, 2)))
        else:
            ist['eşleşmedi'] += 1; out.append(dict(z, metin='', puan=round(max([q for q, zz, _ in puanlar if zz == zi] or [0]), 2)))
json.dump(out, open(os.path.join(K, 'rg_maddeler.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(dict(ist))
