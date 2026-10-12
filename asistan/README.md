# KKTC Hukuk Asistanı — kaynak kodu

Avukatlar için kaynak gösteren mevzuat ve içtihat araştırma sayfasının yapım betikleri.

- `app/template.html` — sayfanın kendisi (veriler yapım sırasında içine/yanına konur)
- `build_kararlar.py` — Yüksek Mahkeme kararlarını alanlara ayırır (veri: `veri/mahkemeler/kararlar`)
- `build_mevzuat.py`, `build_mevzuat2.py`, `build_kat.py` — elle doğrulanan yasaları maddelere ayırır
- `build_tum.py` — diğer tüm yasaları otomatik olarak aranabilir yapar
- `sirali_ayir.py`, `madde_ayir.py` — madde ayırıcılar
- `build_app.py` — sayfayı ve karar dosyalarını üretir
- `raw/kat/` — Kat Mülkiyeti Yasası (35/2010) ve değişiklikleri, Meclis arşivinden (temizlenmiş metin)
- `1_test_dava_dosyasi.txt` — tamamen uydurma deneme dava dosyası (gerçek kişi bilgisi yok)

İkinci dalga yasaların orijinal Word dosyaları depodaki `orijinaller` dalındadır.

## Meclis arşivinden eklenenler (2026-10-12)
- **KKTC Anayasası** (`veri/meclis-ek/metin/anayasa.txt`, kaynak cm.gov.ct.tr/Anayasa.aspx PDF) — `anayasa_bol.py` ile 164 madde + 13 geçici madde + Başlangıç.
  2014 (47/2014) ve 2020 (33/2020) Anayasa değişiklikleri halkoylamasında reddedildi (29 Haziran 2014: %62,3 hayır; 11 Ekim 2020: %50,13 hayır), bu yüzden yürürlükteki metne işlenmemiştir; uygulamada bu değişiklik yasaları notla işaretlenir ve aramada geriye alınır (`build_tum.py` NOTLAR/RED). Kaynak: en.wikipedia.org/wiki/2014_Northern_Cypriot_constitutional_referendum, en.wikipedia.org/wiki/2020_Northern_Cypriot_constitutional_referendum.
- **Yüksek Mahkeme sisteminde dosyası olmayan 54 yasa**: Meclis arşivindeki esas metin + aynı adlı sonraki değişiklik yasaları (`meclis_ek.py`, `veri/meclis-ek/`). Eşleştirme: `raw/meclis_ek/hedef2.json`.
- **Türkçe metni olmayan 26 fasıl**: İngilizce metinlerine Türkçe adları eklendi (Türkçe aramada bulunur).
- **533 Yasa Gücünde Kararname** (2013–2026, cm.gov.ct.tr/YasaKararname.aspx): `ygk_metin.py` (Word içinden metin, taranmış PDF'ler Türkçe yazı tanıma), `veri/meclis-ygk/`. Gerekçe ayrı birim; aynı adla yeniden çıkarılanların eski sürümleri işaretlenir. Aramada kararnamelere ayrı 2 yer verilir.
- Derleme sırası: `meclis_ek.py` → `build_tum.py` → `hmut_bol.py` → `build_app.py` (şablon yamaları: `app/yama_meclis.py`).
- **Resmî Gazete Ek III (2006–2026)**, Devlet Basımevi arşivi: Yüksek Mahkeme sisteminde olmayan 765 tüzük, 936 emirname, 20 yönetmelik, 71 tebliğ (`veri/resmi-gazete/`).
  Akış: Basımevi dizini (`raw/resmi_gazete/rg_liste.json`) → hedef seçimi (A.E. numarasıyla Yüksek Mahkeme tüzük listesine karşı) → sayı PDF'lerinin metin katmanı (tarayıcıda pdf.js) → `rg_bol.py` (yapar cümlesi / kısa isim maddesiyle bölme, dizin başlığıyla bire-bir eşleştirme) → `rg_kaydet.py`.
  Eşleşmeyen ~840 madde: çoğu Gazete'de yalnızca görüntü olarak basılmış sayfalar (yazı tanıma gerekir) veya bölme hatası; 32 sayı Basımevi sitesinde kırık bağlantı (404). Bakanlar Kurulu kararları (Ek IV) kişisel veri içerdiği ve çoğu bireysel idari işlem olduğu için alınmadı.

## Metin onarımı (onar.py)
Kaynak PDF/Word dosyalarından gelen kodlama hataları derleme sırasında onarılır; sözcükler değiştirilmez:
- PDF yazı tipi kayması (harfler 29 kod geri: 'ELUWU' = 'birtr'): satır/sözcük bazında, Türkçe harf-çifti modeline (onar_model.json) göre yalnızca açıkça daha olası olduğunda geri çevrilir; gerçek sayılar korunur.
- Calibri glif kodlaması ('ƚĂƌĂĨŦŶĚĂŶ' = 'tarafından').
- Windows-1254 karışması (ý/þ/ð → ı/ş/ğ; İngilizce metinde ý → i), çeviri aracı etiketleri, denetim karakterleri.
- Anlamsız sembol dizileri silinir ya da '[okunamayan kısım]' olur; onarımdan sonra hâlâ okunamayan bölümlerin metni yerine açık bir not konur (yapay zekâ bozuk metne dayanmaz).
- Kira (Denetim) Yasası el verisinde 7. madde (G) ve (I) bentlerindeki Word nesnesi artıkları, resmî birleştirilmiş metinle karşılaştırılarak çıkarıldı.
Denetim: `python3 bozuk_tara.py app/pub` (kalan çöp dizili birim sayısı).
