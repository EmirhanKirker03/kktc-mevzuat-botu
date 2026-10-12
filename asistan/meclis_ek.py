"""Yüksek Mahkeme sisteminde dosyası olmayan (HTTP 404) yasaların Meclis arşivinden alınan metinlerini kaydeder.
Girdi: hedef2.json (eşleştirme), txt/ (LibreOffice metin çıktısı), ham/ (orijinal dosyalar, SHA-256 için).
Çıktı: veri/meclis-ek/kayit.json + veri/meclis-ek/metin/*.txt"""
import json, os, hashlib, shutil, urllib.parse, sys
K = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/meclis_yeni'
OUT = '/home/claude/kktc-mevzuat-botu/veri/meclis-ek'
h = json.load(open(os.path.join(K, 'hedef2.json'), encoding='utf-8'))
kayit, goruldu = {}, set()
def belge(b):
    ham = os.path.join(K, 'ham', b['dosya'])
    txt = os.path.join(K, 'txt', os.path.splitext(b['dosya'])[0] + '.txt')
    if not (os.path.exists(ham) and os.path.exists(txt)): return None
    hedef = os.path.splitext(b['dosya'])[0].replace(' ', '_') + '.txt'
    t = open(txt, encoding='utf-8-sig').read()
    open(os.path.join(OUT, 'metin', hedef), 'w', encoding='utf-8').write(t)
    return {'sayi': b['sayi'], 'baslik': b['baslik'], 'dosya': b['dosya'], 'url': 'https://cm.gov.ct.tr/Yasalar/' + urllib.parse.quote(b['dosya']),
            'sha256': hashlib.sha256(open(ham, 'rb').read()).hexdigest(), 'metin_dosyasi': 'veri/meclis-ek/metin/' + hedef, 'karakter': len(t)}
for x in h:
    e = x['esas'][0]
    if e['dosya'] in goruldu: continue  # aynı yasanın ikinci kaydı (ör. 49/2014, 33/1970)
    goruldu.add(e['dosya'])
    eb = belge(e)
    if not eb: print('metin yok', x['numara']); continue
    degs = [d for d in (belge(d) for d in x['degisiklik']) if d]
    kayit[str(x['pkey'])] = {'pkey': x['pkey'], 'numara': x['numara'], 'ad': x['ad'], 'esas': eb, 'degisiklik': degs,
                             'degisiklik_sayilari': [d['sayi'] for d in x['degisiklik']]}
an = os.path.join(K, 'a2.txt')
shutil.copy(an, os.path.join(OUT, 'metin', 'anayasa.txt'))
kayit['ANAYASA'] = {'numara': 'Anayasa', 'ad': 'Kuzey Kıbrıs Türk Cumhuriyeti Anayasası', 'esas': {'sayi': '1985', 'baslik': 'Kuzey Kıbrıs Türk Cumhuriyeti Anayasası', 'dosya': '9646521_Anayasa.pdf',
                    'url': 'https://cm.gov.ct.tr/dir_docs/9646521_Anayasa.pdf', 'sha256': hashlib.sha256(open(os.path.join(K, 'anayasa.pdf'), 'rb').read()).hexdigest(),
                    'metin_dosyasi': 'veri/meclis-ek/metin/anayasa.txt', 'karakter': os.path.getsize(an)}, 'degisiklik': []}
json.dump({'kaynak': 'KKTC Cumhuriyet Meclisi arşivi (cm.gov.ct.tr)', 'alindi': '2026-10-12',
           'not': 'Yüksek Mahkeme mevzuat sisteminde dosyası bulunamayan (HTTP 404) yasaların Meclis arşivindeki esas metinleri ve aynı adlı sonraki değişiklik yasaları. Metinler değiştirilmemiştir.',
           'kayitlar': kayit}, open(os.path.join(OUT, 'kayit.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(kayit), 'kayıt;', sum(len(v['degisiklik']) for v in kayit.values()), 'değişiklik metni')
