# KKTC Mevzuat Botu

KKTC'nin kamuya açık iki resmî kaynağından yasa, tüzük ve mahkeme kararı metinlerini **yavaşça** toplar ve bu depoya kaydeder. Bu metinler KKTC hukuk asistanının veri kaynağıdır.

| Kaynak | Ne var | Rolü |
|---|---|---|
| Yüksek Mahkeme mevzuat sistemi (mevzuat.mahkemeler.net) | Değişikliklerle **birleştirilmiş** yasalar, Türkçe ve İngilizce fasıllar, tüzükler, Yüksek Mahkeme kararları | Ana kaynak |
| Cumhuriyet Meclisi arşivi (cm.gov.ct.tr) | Esas yasalar ve her değişiklik yasası ayrı ayrı | Kontrol: birleştirilmiş metin son değişikliği içeriyor mu? |

Kurallar:
- Yalnızca herkese açık sayfalar. Avukat portalı veya giriş gerektiren hiçbir yere bağlanılmaz.
- İstekler arasında 2 saniye beklenir. Bot her istekte kendini bot olarak tanıtır (tarayıcı taklidi yapmaz).
- Alınan belge tekrar indirilmez; kaldığı yerden devam eder.
- Metinler değiştirilmez. Her belge için kaynak adresi, tarih ve SHA-256 parmak izi saklanır. Orijinal dosyalar boyut nedeniyle depoya konmaz.

## Çalıştırma (Actions sekmesi → iş seç → Run workflow)

1. **1 - Erişim testi**: iki siteye de ulaşılabiliyor mu? Sonuç `sonuc/erisim-testi.json`.
2. **3 - Mahkemeler sitesi**:
   - `liste`: yasa, tüzük ve karar listelerini alır; karar metinlerini de kaydeder (yaklaşık 5500 karar).
   - `yasa`: birleştirilmiş yasa dosyalarını indirip metne çevirir (1339 kayıt).
   - `tuzuk`: tüzük dosyaları (3819 kayıt; iki-üç çalıştırma gerekebilir).
3. **2 - Yasaları çek**: Meclis arşivindeki belgeler (dalga 1, 2, 0 veya hepsi).

## Klasörler

| Yol | İçerik |
|---|---|
| `liste/` | Kaynak listeleri (Meclis: 2794 belge; mahkemeler: yasa/tüzük/karar) |
| `veri/mahkemeler/kararlar/` | Karar metinleri (`<kayıt no>.txt`) |
| `veri/mahkemeler/yasalar/`, `tuzukler/` | Birleştirilmiş yasa ve tüzük metinleri |
| `veri/mahkemeler/*-kayit.json` | Her dosya: adres, tarih, SHA-256, durum |
| `veri/metin/`, `veri/kayit.json` | Meclis arşivinden çıkarılan metinler ve kayıtları |
| `scripts/` | Botun kodu |
