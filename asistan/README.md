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
