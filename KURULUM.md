# KKTC Hukuk Asistanı — yayına alma

Bu klasör, asistanı kendi alan adınızda, avukatların e-posta ve şifreyle girdiği bir web uygulaması olarak çalıştırır.
Yapay zekâ cevapları sizin Claude API anahtarınızla üretilir; avukatların ayrı bir Claude hesabına ihtiyacı yoktur.

## Bir kerelik hazırlık (sizin yapmanız gerekenler)

1. **Claude API anahtarı**: https://console.anthropic.com adresinde hesap açın, ödeme yöntemi ekleyin, "API Keys" bölümünden bir anahtar oluşturun.
   Anahtarı kimseyle paylaşmayın; yalnızca Render'daki ortam değişkenine yapıştırın.
2. **Render hesabı**: https://render.com (GitHub hesabınızla giriş yapabilirsiniz).
3. Render'da **New → Blueprint** seçin, `EmirhanKirker03/kktc-mevzuat-botu` deposunu ve **`yayin`** dalını gösterin.
   `render.yaml` dosyası hizmeti ve kalıcı diski kendiliğinden tanımlar (kalıcı disk için Starter plan gerekir).
4. İstenen gizli değerleri girin:
   - `ANTHROPIC_API_KEY`: 1. adımdaki anahtar
   - `YONETICI_EPOSTA`: kendi e-postanız
   - `YONETICI_SIFRE`: en az 10 karakterlik güçlü bir şifre (ilk girişten sonra "Şifre değiştir" ile değiştirin)
   - `OTURUM_SIRRI` Render tarafından otomatik üretilir.
5. Yayına girdikten sonra adres `https://<ad>.onrender.com` olur. Kendi alan adınızı Render'da **Settings → Custom Domains** bölümünden bağlayabilirsiniz.

## Günlük kullanım

- `/yonetim` sayfasından avukat hesabı açın: ad, e-posta, büro ve abonelik bitiş tarihi. Ekranda çıkan geçici şifreyi avukata güvenli bir kanaldan iletin.
- Abonelik uzatmak için tablodaki tarihi değiştirmeniz yeterli. Süresi dolan hesap giriş yapabilir ama yapay zekâyı kullanamaz.
- Kullanıcı başına günlük istek sınırı `GUNLUK_SORU` ile ayarlanır (varsayılan 150).

## Gizlilik

- Sorular, yüklenen belgeler ve cevaplar sunucuda saklanmaz; yalnızca günlük istek sayısı tutulur.
- Avukatlar yalnızca kendi incelemelerini görür; yönetici hepsini görür.
- `/kosullar` sayfası bir taslaktır; yayına almadan önce bir avukata okutun.

## Verileri güncelleme

Yasa, tüzük ve karar dosyaları `veri/` klasöründedir. Yeni veri üretildiğinde `yayin` dalı güncellenir; Render otomatik olarak yeniden yayınlar.
