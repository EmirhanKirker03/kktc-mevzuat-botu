"""Meclis'ten alınan Yasa Gücünde Kararname dosyalarını metne çevirir.
ham/: <dosya>.document.xml (docx içinden), <dosya>.pdftext.txt (metinli PDF), <dosya>.pNNN.jpg (taranmış PDF sayfaları), .doc/.rtf"""
import os, re, sys, subprocess, html, glob, collections
H, T = sys.argv[1], sys.argv[2]
def xml_metin(x):
    x = x.decode('utf-8', 'replace')
    out = []
    for p in re.findall(r'<w:p[ >].*?</w:p>|<w:p/>', x, re.S):
        s = re.sub(r'<w:tab/>', '\t', p); s = re.sub(r'<w:br[^>]*/>', '\n', s)
        s = ''.join(re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>|(\t)|(\n)', s) and [a or b or c for a, b, c in re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>|(\t)|(\n)', s)])
        out.append(html.unescape(s))
    return '\n'.join(out)
dosyalar = os.listdir(H); say = collections.Counter()
for f in sorted(dosyalar):
    yol = os.path.join(H, f)
    if f.endswith('.document.xml'):
        ad = f[:-len('.document.xml')]; open(os.path.join(T, ad + '.txt'), 'w', encoding='utf-8').write(xml_metin(open(yol, 'rb').read())); say['docx'] += 1
    elif f.endswith('.pdftext.txt'):
        ad = f[:-len('.pdftext.txt')]; open(os.path.join(T, ad + '.txt'), 'w', encoding='utf-8').write(open(yol, encoding='utf-8').read()); say['pdf-metin'] += 1
sayfalar = collections.defaultdict(list)
for f in dosyalar:
    m = re.match(r'(.+)\.p(\d{3})\.jpg$', f)
    if m: sayfalar[m.group(1)].append((int(m.group(2)), f))
env = dict(os.environ, TESSDATA_PREFIX='/home/claude/tessdata', OMP_THREAD_LIMIT='1')
from concurrent.futures import ThreadPoolExecutor
def ocr(f): return subprocess.run(['tesseract', os.path.join(H, f), '-', '-l', 'tur', '--psm', '6'], capture_output=True, text=True, env=env).stdout
for ad, ps in sorted(sayfalar.items()):
    ps.sort()
    with ThreadPoolExecutor(8) as ex: metinler = list(ex.map(ocr, [f for _, f in ps]))
    open(os.path.join(T, ad + '.txt'), 'w', encoding='utf-8').write(''.join(t + f'\n[SAYFA {n}]\n' for (n, _), t in zip(ps, metinler))); say['ocr'] += 1
eski = [os.path.join(H, f) for f in dosyalar if re.search(r'\.(doc|rtf)$', f, re.I)]
if eski: subprocess.run(['soffice', '--headless', '--convert-to', 'txt:Text (encoded):UTF8', '--outdir', T] + eski, capture_output=True); say['doc/rtf'] += len(eski)
print(dict(say))
