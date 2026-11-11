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

## Tanıtım sayfası ve deneme istekleri

- Giriş yapmamış ziyaretçi ana adreste **tanıtım sayfasını** (`/tanitim`) görür: araç ne yapar, kaç yasa/karar var, veri ne kadar güncel
  (sayılar veriden kendiliğinden gelir) ve altında **deneme isteği formu**.
- Avukat formu doldurunca istek `/yonetim` sayfasındaki **Deneme istekleri** tablosuna düşer. **Deneme hesabı aç** düğmesi tek tıkla
  7 günlük hesap açar ve geçici şifreyi gösterir; şifreyi avukata telefon ya da WhatsApp ile iletin.
- Deneme bitince avukat giriş yapabilir ama yapay zekâyı kullanamaz. Ödeme alınca **Hesaplar** tablosundan bitiş tarihini uzatın.
- İsteğe bağlı ayarlar (Render → Environment): `ILETISIM` (tanıtımda görünen telefon/e-posta), `FIYAT_METNI` (tanıtımda görünen fiyat cümlesi),
  `DENEME_GUN` (deneme süresi, varsayılan 7).

## Denemeden aboneliğe

- Deneme hesabıyla giren avukat sayfanın üstünde kaç günü kaldığını ve iletişim bilginizi görür. Süre dolunca mevzuatı okumaya devam eder,
  yapay zekâ kapanır ve ekranda "aboneliğinizi başlatın" yazısı çıkar.
- Ödeme alınca Hesaplar tablosunda **+1 ay** ya da **+1 yıl** düğmesine basın: süre uzar, hesap "abone" olur.
- Aboneliği 7 gün içinde bitecek avukatlar tabloda sarı görünür ve kendi ekranlarında da uyarı çıkar; bitmeden arayın.
- Hesap açınca ya da şifre sıfırlayınca avukata gönderilecek mesaj hazır gelir: **Mesajı kopyala** → WhatsApp'a yapıştırın.

## Yedek

- Yönetim sayfasındaki **Yedek indir** bağlantısı bütün hesapları, abonelikleri ve istekleri tek dosya olarak indirir.
  **Haftada bir indirip güvenli bir yerde saklayın**; sunucuya bir şey olursa müşteri listeniz bu dosyadadır.

## Telefonda uygulama gibi

- Avukat siteyi telefonunda açıp tarayıcı menüsünden "Ana ekrana ekle" derse uygulama simgesiyle açılır.

## Maliyet takibi

- Her yapay zekâ isteğinin büyüklüğü (belirteç sayısı) kullanıcı başına tutulur; içerik tutulmaz.
- Render'da `FIYAT_GIRIS` ve `FIYAT_CIKIS` değerlerini girerseniz (kullandığınız modelin 1 milyon giriş / çıkış belirteci başına dolar fiyatı;
  güncel fiyat Anthropic'in fiyat sayfasında yazar) yönetim panelinde her avukatın **son 30 günde size kaça mal olduğu** görünür.
  Fiyatınızı buna bakarak belirleyin: bir avukatın aylık maliyeti, ondan aldığınız ücretin küçük bir kısmı olmalı.
- Maliyeti sınırlayan ayarlar: `GUNLUK_SORU` (kişi başı günlük istek) ve `GUNLUK_KARAKTER`.

## Günlük kullanım

- `/yonetim` sayfasından avukat hesabı açın: ad, e-posta, büro ve abonelik bitiş tarihi. Ekranda çıkan geçici şifreyi avukata güvenli bir kanaldan iletin.
- Abonelik uzatmak için tablodaki tarihi değiştirmeniz yeterli. Süresi dolan hesap giriş yapabilir ama yapay zekâyı kullanamaz.
- Kullanıcı başına günlük istek sınırı `GUNLUK_SORU` ile ayarlanır (varsayılan 60; derin araştırma ve sözleşme incelemesi 2 istek sayılır).

## Gizlilik

- Sorular, yüklenen belgeler ve cevaplar sunucuda saklanmaz; yalnızca günlük istek sayısı tutulur.
- Avukatlar yalnızca kendi incelemelerini görür; yönetici hepsini görür.
- `/kosullar` sayfası bir taslaktır; yayına almadan önce bir avukata okutun.

## Verileri güncelleme

Yasa, tüzük ve karar dosyaları `veri/` klasöründedir. Yeni veri üretildiğinde `yayin` dalı güncellenir; Render otomatik olarak yeniden yayınlar.
