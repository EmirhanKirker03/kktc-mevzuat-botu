# YAPILACAKLAR — KKTC Hukuk Asistanı (devam eden işler)

Bu dosya, işi devralan oturumun (Claude Code web/bulut) okuyup sırayla uygulaması içindir.
Kullanıcı Türkçe konuşur ve İngilizceyi zor anlar: **her mesajı sade Türkçe yaz.**

## Değişmez kurallar
1. Yalnızca **kamuya açık** kaynaklar. Avukat Portalı, giriş isteyen hiçbir sisteme bağlanma, şifre/anahtar isteme.
   (arsiv.basimevi.gov.ct.tr ana sayfası giriş ekranına yönlenir; **giriş yapma**. Yalnızca herkese açık `/Portals/...pdf` dosyaları alınır.)
2. Siteye nazik ol: istekler arasında ~1,5–2 sn bekle, kendini bot olarak tanıt (User-Agent), günlük sınır 60 MB üstüne çıkma.
3. **Metin uydurma yok.** Yasa/tüzük/karar metinleri yalnızca kaynak dosyalardan gelir. İzinli düzeltmeler: kodlama onarımı (`onar.py`)
   ve iki kaynak okumasından birini seçme (`ikili_okuma.py`). Bunların dışında metne dokunma.
4. Ek IV Bakanlar Kurulu kararları alınmaz (kişisel veri).
5. Kullanıcının kimliği görünmesin: commit yazarı `Claude <noreply@anthropic.com>`, e-postası hiçbir yere yazılmaz.
6. Commit mesajlarının sonuna şu iki satır:
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: <bu oturumun bağlantısı>
   ```
7. Var olan bir eşleşmeyi/metni kaybettiren değişiklik kabul edilmez: her değişiklikten önce ve sonra karşılaştır.

## Kurulum (her yeni oturumda bir kez)
```bash
bash asistan/kurulum.sh        # /home/claude/kira_ai -> asistan, /home/claude/rg (Gazete ham metinleri), app/pub (yayin dalından)
```
Betikler `/home/claude/kira_ai`, `/home/claude/rg`, `/home/claude/kktc-mevzuat-botu` yollarını bekler; kurulum bunları bağlar.

## Derleme sırası
```bash
cd /home/claude/kira_ai
python3 build_tum.py           # ~10 dk: yasalar, tüzükler, YGK, Resmî Gazete -> app/pub/tum-*.json
python3 hmut_bol.py
python3 build_kararlar.py      # ~3 dk
python3 build_app.py
python3 test/veri_kalite.py app/pub     # 11/11 geçmeli
```
Testler (Node + Playwright gerekir; `NODE_PATH=/opt/npm-tools/node_modules` ya da `npm i playwright`):
`bash test/sunucular.sh` (statik sayfa 8811, sahte yapay zekâ 8899, sunucu 3100). Arama testleri `yeni` argümanıyla:
`node test/arama_degerlendirme.js yeni` (25/25), `arama_degerlendirme_ayri.js yeni` (10/10), `anayasa_meclis_test.js yeni` (10/10),
`deg_usul.js` (42/42), `deg_turkce.js` (12/12), `e2e_araclar.js` (23 GEÇTİ), `guvenlik.js` (30/30), `tanitim_test.js` (20/20).
Hiçbiri geriye gitmemeli.

## Durum (16 Ekim 2026)
- 1.299 yasa, ~3.630 YM tüzüğü, 533 YGK, 1.929 Resmî Gazete metni, 5.494 karar.
- Yüksek Mahkeme sistemindeki 2.726 tüzük **yalnızca taranmış resim**; metinleri yazı tanıma ile okundu (hata içerir).
- `ikili_okuma.py`: bu tüzüklerin Resmî Gazete'deki ikinci okumasıyla kelime kelime karşılaştırma; iki okuma farklıysa sözlükte
  olan (temiz kaynaklardan kurulan `onar_sozluk.json`) seçilir. Sayılara dokunulmaz. Sonuç `ikili_okuma.json`, `build_tum.py` uygular
  (`IKILI=0` ile kapatılır; `ikili_okuma.py` her zaman **IKILI=0 ile derlenmiş** app/pub üzerinde çalıştırılmalı).
- Son durum: 2.218 taranmış tüzük Gazete dizininde bulundu; 2.026'sının Gazete metni indirildi; 811 tüzükte 4.094 kelime grubu
  ikinci okumayla düzeltildi (343 tüzükte iki metin uyuşmadığı için dokunulmadı). Örneklemde yanlış seçim ~%3 görüldü → iş 2.
- Akış: `rg_plan.py` (hangi tüzük hangi Gazete sayısında) → `rg_dogrula.py` (Gazete'de bul, böl) → `ikili_okuma.py` → derleme.

## 16 Ekim 2026 bulut oturumu
- İş 1 ve iş 4 **yapılamadı**: bulut ortamının ağ ayarı arsiv.basimevi.gov.ct.tr, basimevi.gov.ct.tr ve cm.gov.ct.tr'yi kapatıyor (403).
  Bilgisayardaki oturumda yapılmalı.
- İş 2 bitti: `ikili_olcum.md` — 200 örnekte yanlış seçim %1 (+%0,5 şüpheli), %2 altında; kural değişmedi.
  Tek düzenli hata: çok sözcüklü grupta bir sözcük bozuksa grubun hepsi değişiyor ("konmak" → "korunak", 8 kez).
- İş 3 bitti: `rg_bol.py` üçüncü tur "Sayı : <A.E. no>" çapası (yalnızca kullanılmamış bölgelerde). 583 → 386 eşleşmeyen;
  197 yeni eşleşme, eski eşleşmelerden değişen 0, 25 örnek elle kontrol: 25/25 doğru. veri/resmi-gazete 2.133 → 2.329 kayıt.
- rg_ek1.tgz (bilgisayardaki oturumdan 80 sayı) eklendi, akış yeniden çalıştırıldı: Gazete'de eşleşen taranmış tüzük 1.811 → 1.895,
  ikili okumayla düzeltilen tüzük 811 → 857 (4.409 kelime grubu); eski düzeltmeler birebir aynı. Bu sayılar rg_bol hedeflerinde
  olmadığı için Gazete maddelerine yeni eşleşme eklemedi. İş 1'den yalnızca 2020/174 ve 24 adet /Portals/6/ (404) eksik.
- İkinci tur (rg_bol): A.E. çapası artık "Sayı : 436   1071" gibi sayfa numaralı satırları da alıyor; Ek IV numaraları dışlanıyor.
  8 yeni eşleşme (8/8 elle doğru), eşleşmeyen 386 → 378, veri/resmi-gazete 2.337 kayıt. Kalan 378'in ~199'u başka hedefe
  verilmiş bölüm içinde, ~84'ü metinde bulunamıyor (çoğu Ek IV'e ya da ilanlara ait olabilir), ~95'i boş bölgelerde ama A.E. satırı okunamamış.
- Kalan eşleşmeyenlerin ~204'ü başka bir hedefe verilmiş bölümün içinde (aynı parçada iki metin); bunları ayırmak eski
  metinleri kısaltacağı için yapılmadı.

## 29 Ekim 2026 bilgisayar oturumu (güncellik denetimi)
- Yasalar: Meclis kataloğundaki 2026'nın tüm değişiklik yasaları (1–70/2026) tek tek denetlendi; Yüksek Mahkeme
  metinleri hepsini içeriyor. 8–13 Ekim'de çıkan 71–74/2026 (Yurttaşlık, Siyasal Partiler, Belediyeler, AÖA Kuruluş)
  `sonraki_degisiklikler.json`'a eklendi (73/2026 Meclis'te henüz yok: Gazete 203'ten yazı tanıma, `ocr: true`).
  Yüksek Mahkeme metni bu yasaları içerdiğinde (yasa listesi yeniden indirilince) bu girdiler silinmeli.
- Eski "metne işlenmemiş" uyarılarından 3'ü yanlıştı (değişiklik metinde birebir vardı): kaldırıldı, `sd_islenmis.json`.
  Kalan 9 yasadaki uyarılar elle doğrulandı (yeni metin Yüksek Mahkeme metninde yok).
- guncellik_tum.json'daki diğer "eksik"ler (Daire kuruluş yasaları, Seçim Geçici Kurallar, KDV İadesi) yanlış ad
  eşleşmesi: değişiklik başka bir yasaya ait ya da metinde var.
- YGK: Meclis listesi 7.10.2026'ya kadar tam; Gazete'de sonrasında yeni YGK yok.
- Resmî Gazete: 203–211 (13–28.10.2026) indirildi (`rg_ek2.tgz`), 11 yeni tüzük/emirname. Sayı 193'ün bozuk metin
  katmanlı 14 sayfası yazı tanımayla okundu: 933/2026 ve 940/2026 eklendi.
- rg_bol düzeltmesi: metinlerin sonuna aynı sayıdaki başka ilanlar taşıyordu (Merkez Bankası kurları, vaziyet, çek
  yasağı listeleri — kişi adları dahil). ~1.530 metinde bir sonraki "Sayı : N" satırında kesildi; ~640 metnin başı
  kendi Sayı satırından alındı (fiyat tablosu gibi önce basılan kısımlar). Kaybolan eşleşme 0; 50+ örnek elle kontrol.
- Mahkemeler sitesi listesi 29.10'da yeniden alındı (iş akışı 3, `liste`): yeni yasa 0, yeni karar 0, yeni tüzük 20
  (18'i zaten Gazete'den vardı, 2'si yukarıda eklendi). Not: `indir tuzuk` 'metin-cok-kisa' olanları da baştan
  indiriyor (2.900+); yeni tüzükleri almak için `secili` kullanılmalı.
- İş 4 incelendi: 316 taranmış yasanın 304'ü İngilizce fasıl (Meclis'te ikinci kaynak yok); Türkçe 12'nin yalnızca
  31/1970'in (yürürlükten kalkmış) Meclis'te Word dosyası var. Bu iş fiilen kapandı.
- Derleme 7.581 kayıt; kalite 11/11; arama 25/25, 10/10, 10/10, 42/42, 12/12; e2e 23; güvenlik 30/30; tanıtım 20/20.
  Sayfa sürüm 57.

## Haftalık güncelleme (zamanlanmış görev bunu uygular)
Kullanıcının bilgisayarındaki tarayıcı gerekir (devlet siteleri bulut ortamını engelliyor). Adımlar:
1. `bash asistan/kurulum.sh`. Son haftalık raporu oku: `sonuc/haftalik.md` (varsa).
2. **Resmî Gazete**: tarayıcıda https://basimevi.gov.ct.tr/ ana sayfasındaki tablodan bu yılın sayı listesini al
   (`/home/claude/rg/rl<yıl>.json` biçimi: `{s, t, u, i: [[ek, ae, başlık]]}`), `rg_liste.json`'da olmayan sayıları ekle.
   Yeni sayılardaki Ek III tüzük/emirname/yönetmelik/tebliğ maddelerini (başlıkta TÜZÜ/EMİRNAME/YÖNETMELİ/TEBLİĞ geçen,
   Yüksek Mahkeme tüzük listesinde A.E. numarası olmayan) `rg_hedef_ham.json`'a ekle. Bu sayıların PDF'lerini tarayıcıda
   pdf.js ile metne çevir (sayfalar `\n[SAYFA n]\n`), boş/bozuk sayfaları tesseract.js (tur) ile oku; `metin/6_<yıl>_<sayı>.pdf.txt`.
   Sonra `rg_bol.py` → eski çıktıyla karşılaştır (kaybolan eşleşme 0 olmalı) → `rg_kaydet.py`. Yeni metinleri
   `raw/resmi_gazete/rg_ekN.tgz` olarak arşivle.
3. **Yasalar**: tarayıcıda https://cm.gov.ct.tr/Yasalarr.aspx listesinin en üstündeki yasalar (sayı/yıl). Bilinen son sayıdan
   (şu an 74/2026) sonrakileri incele: değişiklik yasası ise ve Yüksek Mahkeme metni o sayıyı içermiyorsa Word dosyasını
   (yazı tipleri çıkarılarak) indir, LibreOffice ile metne çevir, `sonraki_degisiklikler.json`'a ekle (başlık, url, sha256).
   Meclis'te henüz yoksa Resmî Gazete Ek I'den yazı tanımayla al (`ocr: true`). Yeni esas yasa çıktıysa raporla.
4. Yüksek Mahkeme listesi: iş akışı 3 (`liste`) GitHub API ile çalıştır; yeni karar/tüzük varsa raporla. Ayın ilk haftasında
   iş akışı 6 (değişen yasa denetimi) kendiliğinden çalışır; `sonuc/degisim-yasa.json`'daki değişenleri raporla.
5. `python3 sd_temizle.py` → derleme → `test/veri_kalite.py` → testler (hepsi geçmeli).
6. Commit (main + yayin `veri/`), sayfayı yayınla (değişen dosyalar, 45 MB'lık parçalar), `sonuc/haftalik.md`'ye kısa Türkçe rapor yaz.
7. Kullanıcıya sade Türkçe kısa özet: kaç yeni metin, hangi yasalar değişti, sorun var mı.

## Sıradaki işler (öncelik sırasıyla)
1. **Arşivden 77 Gazete sayısı eksik** (`/home/claude/rg/indirilecek.json` içindeki `/Portals/105/...` olanlar; 24 tanesi
   `/Portals/6/` sitede 404, onlar alınamaz). İnternete erişim
   varsa indir (pdf.js ya da `pdfplumber` ile metin katmanı, sayfalar arası `\n[SAYFA n]\n`), `metin/105_<yıl>_<sayı>.pdf.txt` olarak kaydet,
   sonra `rg_dogrula.py` → `ikili_okuma.py` → derleme. Siteye erişilemiyorsa bu işi atla ve kullanıcıya söyle (kullanıcının bilgisayarındaki
   oturum indirebilir).
2. **İkili okumanın kalitesini ölç**: `ikili_okuma.json`'daki değişikliklerden rastgele 200 tanesini çıkar, her biri için iki okumayı ve seçimi
   tabloya dök; yanlış seçim oranı %2'nin üstündeyse kuralı (`ikili_okuma.py`, `sec = ...` satırları) sıkılaştır.
3. **Eşleşmeyen ~580 Gazete maddesi** (`rg_maddeler.json`'da `metin == ''`): `rg_bol.py`'nin bölme çapalarını geliştir. Her denemede
   eski çıktıyla karşılaştır; **kaybedilen eşleşme 0** olmalı, yeni eşleşmelerden 25'ini elle (başlık ↔ "Bu Tüzük ... olarak isimlendirilir"
   cümlesi) kontrol et.
4. **Taranmış 316 yasa** (`tum-dizin.json`'da `o: true`, `tz` yok): Cumhuriyet Meclisi arşivinde (cm.gov.ct.tr, kamuya açık) aynı yasanın
   metin katmanlı PDF'i varsa `ikili_okuma` yöntemini yasalara da uygula.
5. Her şey bitince: derleme + tüm testler + `test/veri_kalite.py`; `asistan/` değişikliklerini **main**'e, `app/pub` içeriğini **yayin** dalının
   `veri/` klasörüne commit et ve gönder.

## Yayın (uygulama sayfası)
Sayfa: https://claude.ai/artifact/X7hh2MnbKDgGcfU3cZP87w — `app/pub` klasörünün kendisi (sayfa `kira_asistani.html`, veri `tum-*.json`,
`karar-*.json`). Bu oturumda Artifact aracı varsa: değişen dosyaları önce okuyup (read, en fazla 64 MB/çağrı) sonra 50 MB'lık parçalar hâlinde
yayınla; yoksa yalnızca yayin dalını güncelle ve kullanıcıya "sayfayı güncellemek için bilgisayarındaki oturuma 'yayınla' yaz" de.
