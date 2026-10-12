"""Meclis'in yayımladığı KKTC Anayasası PDF metnini (pdftotext, düzensiz kip) maddelere ayırır.
Biçim: <kenar başlığı>\nMadde N\n<metin>. Kısım/bölüm başlıkları maddeden atılır. Metin değiştirilmez."""
import re, sys, json
BOLUM = re.compile(r'^(?:[A-ZÇĞİÖŞÜ]+ (?:KISIM|BÖLÜM)|[A-ZÇĞİÖŞÜ ,()]{4,})$')
def ayir(t):
    t = t.replace('\f', '').replace('\r', '')
    bas = t.find('\nBAŞLANGIÇ\n')
    satirlar = t.split('\n')
    idx = [i for i, s in enumerate(satirlar) if re.fullmatch(r'\s*(Geçici )?Madde \d+\s*', s)]
    idx = [i for i in idx if sum(len(x) for x in satirlar[:i]) > 0]
    out = []
    # içindekiler bölümünde "Madde" geçmiyor; ilk "Madde 1" gövdedir
    for k, i in enumerate(idx):
        no = satirlar[i].strip().replace('Madde ', '')
        # başlık: hemen üstteki boş olmayan satır(lar); kısım/bölüm başlıkları değil
        j = i - 1; bas_s = []
        if j >= 0 and not satirlar[j].strip() and j - 1 >= 0 and satirlar[j - 1].strip() and not satirlar[j - 1].rstrip().endswith(('.', ':', ';', ',')): j -= 1
        while j >= 0 and satirlar[j].strip() and not BOLUM.match(satirlar[j].strip()) and len(bas_s) < 2 and not re.match(r'^\(\d+\)|^\([a-zçğıöşü]\)', satirlar[j].strip()) and not satirlar[j].rstrip().endswith(('.', ':', ';', ',')):
            bas_s.insert(0, satirlar[j].strip()); j -= 1
        son = idx[k + 1] if k + 1 < len(idx) else len(satirlar)
        govde = satirlar[i + 1:son]
        # sonraki maddenin başlığını ve kısım/bölüm başlıklarını sondan at
        if k + 1 < len(idx):
            n_bas = out_bas_say = 0
            jj = son - 1
            while jj > i and (not satirlar[jj].strip() or BOLUM.match(satirlar[jj].strip()) or (n_bas < 2 and not satirlar[jj].rstrip().endswith(('.', ':', ';', ',')) and not re.match(r'^\(\d+\)', satirlar[jj].strip()) and satirlar[jj-1].strip()=='' )):
                if satirlar[jj].strip() and not BOLUM.match(satirlar[jj].strip()): n_bas += 1
                jj -= 1
            govde = satirlar[i + 1:jj + 1]
        metin = '\n'.join(s.rstrip() for s in govde).strip()
        metin = re.sub(r'\n{3,}', '\n\n', metin)
        metin = re.sub(r'\n+[A-ZÇĞİÖŞÜ]+ (?:KISIM|BÖLÜM)\n[^\n]*(?:\n\n[A-ZÇĞİÖŞÜ]+ (?:KISIM|BÖLÜM)\n[^\n]*)*\s*$', '', metin).strip()
        metin = re.sub(r'\n+[A-ZÇĞİÖŞÜ]+ (?:KISIM|BÖLÜM)\n[^\n]*\n+[A-ZÇĞİÖŞÜ]+ BÖLÜM\n[^\n]*\s*$', '', metin).strip()
        mm = list(re.finditer(r'\n[A-ZÇĞİÖŞÜ]+ (?:KISIM|BÖLÜM)\s*\n', metin))
        if mm and len(metin) - mm[0].start() < 250: metin = metin[:mm[0].start()].strip()
        out.append({'no': no, 'baslik': ' '.join(bas_s), 'metin': metin})
    giris = t[bas:t.find('\nBİRİNCİ KISIM', bas)].strip() if bas > 0 else ''
    return giris, out
if __name__ == '__main__':
    g, ms = ayir(open(sys.argv[1], encoding='utf-8').read())
    for m in ms: print(f"{m['no']:>10} | {m['baslik'][:50]:50} | {len(m['metin']):5} | {m['metin'][-60:]!r}")
    print(len(ms), 'madde; başlangıç', len(g))
