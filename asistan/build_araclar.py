# Avukat araçları için kaynak verisi: süre kuralları, zaman hesabı, tatiller, HMUT formları.
# Her kuralın alıntısı ilgili resmî metinde birebir aranır; bulunamazsa derleme durur.
import json, re, sys

PUB = 'app/pub/'
D = {str(y['p']): y for y in json.load(open(PUB + 'tum-dizin.json'))['yasalar']}
def metin(p):
    y = D[p]; P = json.load(open(PUB + f"tum-{y['b']}.json"))[p]
    return y, P
norm = lambda s: re.sub(r'\s+', ' ', re.sub(r'(\w)-\s*\n?\s*(\w)', r'\1\2', s.replace('­', ''))).strip()

# HMUT birleştirilmiş metin
hy, hm = metin('T7384')
if not str(hm[1]['no']).startswith('Emir'): sys.exit('Önce hmut_bol.py çalıştırılmalı (HMUT Emir/nizam birimlerine bölünmemiş).')
HU = {m['no']: m for m in hm}
HUN = {k: norm(m['metin']) for k, m in HU.items()}
# Ceza Muhakemesi Usulü (elle doğrulanmış set)
dal2 = json.load(open('mevzuat_dalga2.json'))['yasalar']
CMUK = [L for L in dal2 if L['kod'] == 'CMUK'][0]
CM = {str(m['no']): norm(m['metin']) for m in CMUK['maddeler']}
# Yorum Yasası (Fasıl 1) ve Resmi Tatil Yasası (49/1984)
yy, ym = metin('946'); YN = norm('\n'.join(m['metin'] for m in ym))
ty, tm = metin('654'); TN = norm('\n'.join(m['baslik']+'\n'+m['metin'] for m in tm))

HMUT = {'kaynak': 'Hukuk Muhakemeleri Usulü Tüzüğü (Birleştirilmiş)', 'url': hy['u'], 'p': 'T7384'}
CMK = {'kaynak': 'Ceza Muhakemeleri Usulü Yasası (Fasıl 155)', 'url': CMUK.get('url', ''), 'p': 'CMUK'}

SURELER = [
  dict(id='ist-ara', nizam='Emir 35 n.2', grup='Hukuk · istinaf', ad='Ara emrine veya dava sayılmayan meseledeki emre karşı istinaf', miktar=14, birim='gun',
       bas='Emrin istinaf edecek taraf için bağlayıcı olduğu tarih', yer='Emir 35, nizam 2(1)', src=HMUT,
       alinti='herhangi bir ara emrine karşı veya dava sayılmayan herhangi bir meselede verilen bir emre karşı, ilgili emir gerek kesin gerek ara emri olsun, on dört gün geçtikten sonra',
       not_='Mahkeme, yargıç veya İstinaf Mahkemesi süreyi uzatabilir (aynı nizam).'),
  dict(id='ist-hukum', nizam='Emir 35 n.2', grup='Hukuk · istinaf', ad='Hüküm ve diğer emirlere karşı istinaf', miktar=6, birim='hafta',
       bas='Hükmün istinaf edecek taraf için bağlayıcı olduğu tarih (dilekçe reddinde ret tarihi)', yer='Emir 35, nizam 2(1)', src=HMUT,
       alinti='ve diğer emirlerde ise, altı hafta geçtikten sonra, istinafa gidilemez',
       not_='İstinaf ihbarnamesi aynı süre içinde dosyalanır ve doğrudan etkilenen taraflara tebliğ edilir (Emir 35 n.3).'),
  dict(id='ist-masraf', nizam='Emir 35 n.2', grup='Hukuk · istinaf', ad='Mukayyitçe tespit edilen masraflar için istida (istinaf öncesi)', miktar=14, birim='gun',
       bas='Masrafların mukayyitçe tespit edildiği tarih', yer='Emir 35, nizam 2(4)', src=HMUT,
       alinti='masrafları mukayyit tespit etmişse, tespitten itibaren 14 gün içerisinde dosyalanır',
       not_='Masrafları mahkeme tespit etmişse süre, istinaf süresi kadardır (aynı fıkra).'),
  dict(id='talep-takriri', nizam='Emir 20 n.1', grup='Hukuk · layihalar', ad='Talep takririnin dosyalanması ve davalıya verilmesi', miktar=10, birim='gun',
       bas='İspatı vücut kaydının yaptırıldığı tarih', yer='Emir 20, nizam 1', src=HMUT,
       alinti='ispatı vücut kaydı yaptırıldıktan sonra on gün içinde, mahkeme veya yargıç bu süreyi uzatmamış ise, bir talep takriri dosyalar',
       not_='Celpname üzerinde özel açıklama yapılmışsa (Emir 2 n.6) ayrıca talep takriri verilmez.'),
  dict(id='mudafaa', nizam='Form 2', grup='Hukuk · layihalar', ad='Özel açıklamalı celpnamede müdafaanın verilmesi (gıyabi hüküm riski)', miktar=14, birim='gun',
       bas='İspatı vücut kaydı için tayin edilen sürenin son günü', yer='Form 2 (arkasında özel açıklama yapılan celpname), İhtar (2)', src=HMUT,
       alinti='Davalı isbatı vücut kaydı için tayin kılınan müddetin son gününden itibaren on dört gün zarfında müdafaasını vermekte kusur ederse',
       not_='Bu süre tüzüğün Form 2 celpnamesindeki ihtardan alınmıştır; davanızdaki celpnamenin ihtarını ve ilgili Emir hükmünü ayrıca kontrol edin.'),
  dict(id='emir65-savunma', nizam='Emir 65 n.2', grup='Hukuk · küçük talepler (Emir 65)', ad='100.000 TL\'yi aşmayan davalarda yazılı savunma', miktar=14, birim='gun',
       bas='Celpnamenin davalıya tebliğ edildiği tarih', yer='Emir 65, nizam 2(2)', src=HMUT,
       alinti='celpnamenin tebliğ edildiği tarihten başlayarak on dört gün içinde savunmasını yazılı olarak davacıya',
       not_='Haksız Fiiller Yasası altındaki davalar Emir 65 kapsamı dışındadır (Emir 65 n.1).'),
  dict(id='resen-emir', nizam='Emir 1(B) n.2', grup='Hukuk · istidalar', ad='Resen verilen emrin iptali/değiştirilmesi için istida (emirde süre yoksa)', miktar=7, birim='gun',
       bas='Emrin ilgili tarafa tebliğ edildiği tarih', yer='Emir 1(B), nizam 2(6)(b)', src=HMUT,
       alinti='Mahkeme emrinde bir süre belirlenmemişse, emrin ilgili tarafa tebliğinden en geç yedi (7) gün içinde',
       not_='Emirde süre belirlenmişse o süre uygulanır (aynı nizam (a) bendi).'),
  dict(id='celpname-teblig', nizam='Emir 5 n.2', grup='Hukuk · tebligat', ad='Tebliğ edilemeyen celpname için tebliğ mazbatasının dosyalanması (Emir 65 dışı)', miktar=1, birim='ay',
       bas='Celpnamenin mühürlendiği tarih', yer='Emir 5, nizam 2', src=HMUT,
       alinti='Emir 65 dışında dosyalanan herhangi bir celpname mühürlendikten itibaren 1 ay zarfında',
       not_='Emir 65 celpnamelerinde mazbata duruşmadan en az 7 gün önce dosyalanır.'),
  dict(id='ceza-agir', grup='Ceza · istinaf', ad='Ağır Ceza Mahkemesi mahkûmiyetine karşı istinaf ihbarnamesi / izin dilekçesi', miktar=10, birim='gun',
       bas='Kararın açıklandığı tarih', yer='m.132(2)-(3)', src=CMK, madde='132',
       alinti='kararın açıklandığı tarihten başlayarak on gün içinde Başmukayyide bir istinaf ihbarnamesi sunar',
       not_='Süre, iyi sebep gösterilirse Yüksek Mahkemece uzatılabilir (m.134).'),
  dict(id='ceza-kaza', grup='Ceza · istinaf', ad='Kaza Mahkemesi mahkûmiyetine karşı istinaf ihbarnamesi / izin dilekçesi', miktar=10, birim='gun',
       bas='Kararın açıklandığı tarih', yer='m.133(2)-(3)', src=CMK, madde='133',
       alinti='kararın açıklandığı tarihten başlayarak on gün içinde mahkum edildiği Kaza Mahkemesi Mukayyidine bir istinaf ihbarnamesi sunar',
       not_='Süre, iyi sebep gösterilirse Yüksek Mahkemece uzatılabilir (m.134).'),
]
hata = []
for r in SURELER:
    hedef = CM[r['madde']] if r['src'] is CMK else HUN.get(r['nizam'], '')
    if norm(r['alinti']) not in hedef: hata.append(r['id'] + ' (alıntı ' + (r.get('nizam') or 'm.' + r.get('madde', '')) + ' içinde yok)')
if 'Emir 1(B)' not in ''.join(r['yer'] for r in SURELER): pass
# Emir 1(B) başlığı ve Emir 5'in gerçekten bu metinlerde olduğunu doğrula
for b, bas_ in [('Emir 35 n.2', 'İstinaflar'), ('Emir 20 n.1', 'Talep takriri'), ('Emir 5 n.2', 'Celpnamenin tebliği'), ('Emir 1(B) n.2', 'Mahkemenin dava yönetimi yetkileri'), ('Emir 61 n.1', 'Mahkeme oturumları')]:
    if b not in HU or HU[b]['baslik'] != bas_: hata.append('birim/başlık: ' + b)
if not HU.get('Emir 65 n.2', {}).get('baslik', '').startswith('100.000'): hata.append('birim: Emir 65 n.2')

YORUM = dict(kaynak='Yorum Yasası (Fasıl 1)', yer='m.31 (Zaman Hesaplanması)', url=yy['u'], p='946',
  a='herhangi bir olayın yer alması veya bir fiilin, eylemin veya işlemin veya şeyin işlenmesi veya yapılmasından sonraki gün süresi, olayın yer aldığı veya fiilin, eylemin veya işlemin veya şeyin yapıldığı günü içine almaz.',
  b='Sürenin son günü, pazar veya resmi tatil günü ise,',
  b2='bu süre, dikkate alınmayan günün ertesi gününü de içine alır;',
  d='Bir fiilin, eylemin veya işlemin altı günü geçmeyen bir süre içinde yapılmasına emir verilmesi veya izin verilmesi halinde, dikkate alınmayan günler, zaman hesaplamasında, hesaba katılmaz.')
for k in ('a', 'b', 'b2', 'd'):
    if norm(YORUM[k]) not in YN: hata.append('yorum-' + k)

SABIT = [('01-01', 'Yılbaşı günü'), ('04-23', 'Ulusal Egemenlik ve Çocuk Bayramı'), ('05-01', 'İşçi ve Bahar Bayramı'), ('05-19', 'Gençlik ve Spor Bayramı'),
         ('07-20', 'Barış ve Özgürlük Bayramı'), ('08-01', 'Toplumsal Direniş Bayramı'), ('08-30', 'Zafer Bayramı'),
         ('10-29', 'Türkiye Cumhuriyeti, Cumhuriyet Bayramı'), ('11-15', 'KKTC Cumhuriyet Bayramı')]
AYLAR = {'01': 'Ocak', '04': 'Nisan', '05': 'Mayıs', '07': 'Temmuz', '08': 'Ağustos', '10': 'Ekim', '11': 'Kasım'}
for md, ad in SABIT:
    g = str(int(md[3:])) + ' ' + AYLAR[md[:2]]
    if g not in TN: hata.append('tatil-' + md)
for ok in ['Şeker Bayramı (Üç gün)', 'Kurban Bayramı (Dört gün)', 'Mevlit', 'Toplam 17 Gün']:
    if ok not in TN: hata.append('tatil-' + ok)
TATIL = dict(kaynak='Resmi Tatil ve Anma Günleri Yasası (49/1984), Ek Cetvel', url=ty['u'], p='654', sabit=SABIT,
             degisken='Şeker Bayramı (üç gün), Kurban Bayramı (dört gün) ve Mevlit de resmî tatildir; tarihleri her yıl değiştiği için aşağıya kendiniz ekleyin.')
ADLI = dict(kaynak='HMUT Emir 61, nizam 1-2', alinti='l Temmuz tarihinden 15 Eylül tarihine kadar olan süre, her iki gün dahil, Yüksek Mahkemenin yıllık adli tatili olacaktır.')
if norm(ADLI['alinti']) not in HUN.get('Emir 61 n.1', ''): hata.append('adli')
ADLI['birim'] = 'Emir 61 n.1'

# HMUT formları: hmut_bol.py'nin ayırdığı "Form N" birimleri
FORMLAR = []
for no_, m in HU.items():
    if not no_.startswith('Form '): continue
    govde = m['metin']
    satirlar = [x.strip() for x in govde.split('\n') if x.strip()]
    baslik = ''
    for x in satirlar[:6]:
        if len(x) > 6 and (x.isupper() or re.search(r'\(E\.\s?\d', x)): baslik = (baslik + ' ' + x).strip()
        if re.search(r'\(E\.\s?\d', baslik): break
    if not baslik: baslik = m['baslik'] or (satirlar[0] if satirlar else '')
    baslik = re.split(r'\s+DAVACI\s*:|\.{4,}', baslik)[0].strip(' .')
    emir = re.search(r'\(E\.?\s?(\d+\s?[A-Z]?),?\s*n\.?\s*([\dl]+)\)', baslik)
    FORMLAR.append(dict(no=no_[5:], birim=no_, baslik=re.sub(r'\s+', ' ', baslik)[:160], emir=(f"Emir {emir.group(1).strip()}, nizam {emir.group(2).replace('l','1')}" if emir else ''), metin=govde[:12000]))
if len(FORMLAR) < 70: hata.append('form sayısı ' + str(len(FORMLAR)))
# Form 1 ve 2: celpname
for f in FORMLAR:
    if f['no'] in ('1', '2') and 'CELPNAME' not in f['baslik'].upper(): f['baslik'] = (f['baslik'] + ' (Celpname)').strip()

if hata:
    print('DOĞRULANAMADI:', hata); sys.exit(1)
json.dump(dict(sureler=[{k.rstrip('_'): (v if k != 'src' else {kk: vv for kk, vv in v.items()}) for k, v in r.items()} for r in SURELER],
               yorum=YORUM, tatil=TATIL, adli=ADLI, hmut_url=hy['u']), open('araclar.json', 'w'), ensure_ascii=False)
json.dump(dict(kaynak=HMUT['kaynak'], url=hy['u'], formlar=FORMLAR), open(PUB + 'formlar.json', 'w'), ensure_ascii=False)
print('süre kuralı', len(SURELER), 'form', len(FORMLAR))
for f in FORMLAR: print(f['no'], '|', f['baslik'][:100], '|', f['emir'], len(f['metin']))
