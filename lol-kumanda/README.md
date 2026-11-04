# LoL Kumanda

League of Legends'ta **maçı telefondan kabul et**, **şampiyon seçimini ve banını telefondan yap**.

Bilgisayarda küçük bir program çalışır; telefonundan tarayıcıyla (aynı Wi-Fi'de) bağlanırsın. Kuruluma uygulama mağazası, hesap ya da şifre gerekmez.

| Ne yapar | Ayrıntı |
|---|---|
| ✅ Maç kabul | "Maç bulundu" olunca telefon çalar ve titrer; **Kabul et** / **Reddet**. İstersen otomatik kabul (gecikmeli). |
| 🚫 Ban | Sıra sana gelince ızgaradan ya da aramayla şampiyonu seç, **Banla**. |
| ⭐ Seçim | Şampiyona dokun (istemcide de işaretlenir), **Kilitle**. Sıran gelmeden niyet belirtebilirsin. |
| 🔎 Arama | Türkçe uyumlu: `kaisa`, `nunu`, `mf`, `tf`, `j4`, `wukong`… |
| ★ Favoriler | Seçim ve ban için ayrı favori listeleri; en üstte durur. |
| 👥 Takım tahtası | Takımın ve rakibin seçimleri, banlar, kimin sırası, geri sayım. |
| 🔮 Büyü ve rün | Sihirdar büyülerini değiştir, rün sayfanı seç. |
| ↔ Takas | Takım arkadaşının şampiyon/sıra takası isteğini kabul et ya da reddet. |
| 🎲 ARAM | Zar at, yedek kulübesinden şampiyon al. |
| 🎮 Lobi ve sıra | Lobi kur (Dereceli, Esnek, Seçmeli, ARAM, Arena), koridor seç, sıraya gir, sıradan çık, oyundan sonra tekrar oyna. |
| 📲 Telegram (isteğe bağlı) | Telefon cebindeyken bile "Maç bulundu" bildirimi ve tek dokunuşla kabul; sıran gelince favori düğmeleri. |

```
 Telefon (tarayıcı) ──Wi-Fi──► Bilgisayar: LoL Kumanda ──► League istemcisi (yerel API)
                                         └──(isteğe bağlı)──► Telegram botu
```

---

## Kurulum (Windows)

1. **Node.js'i kur:** https://nodejs.org/tr/download → **LTS** sürümünü indir, kur (hepsine "İleri").
2. **Dosyaları indir:** GitHub'da depo sayfası → yeşil **Code** düğmesi → **Download ZIP**. ZIP'i aç; içindeki `lol-kumanda` klasörünü istediğin yere (örn. Masaüstü) kopyala.
3. `lol-kumanda` klasöründe **`baslat.bat`** dosyasına çift tıkla.
   - İlk açılışta gerekli paketler bir kez kurulur (internet gerekir, ~10 sn).
   - **Windows Güvenlik Duvarı** sorarsa **Erişime izin ver** de. ("Özel ağlar" işaretli olsun.)
4. Açılan pencerede bir **QR kod** ve `http://192.168.x.x:4747/?t=…` gibi bir adres görünür. İlk açılışta QR sayfası tarayıcıda da açılır.
5. Telefon bilgisayarla **aynı Wi-Fi ağında** olsun. Telefonun kamerasıyla QR kodu tara → sayfa açılır.
6. (Önerilir) Tarayıcı menüsünden **Ana ekrana ekle**: uygulama gibi tam ekran açılır.
7. League of Legends'ı aç. LoL Kumanda istemciyi kendisi bulur ve bağlanır.

> Pencere açık kaldığı sürece çalışır. Kapatmak için pencereyi kapat ya da `Ctrl+C`.
> Erişim anahtarı (`?t=…`) bir kez taranınca telefonda hatırlanır; sonraki açılışlarda yeniden taramak gerekmez.

### League'i açmadan denemek

**`demo.bat`** sahte bir League istemcisiyle çalışır: sıraya gir, maç bulunur, botlarla ban/seçim yapılır. Arayüzü tanımak için ideal.

### Hazır .exe (Node.js kurmadan)

Bu klasör `main` dalındayken GitHub'da **Actions → LoL Kumanda → Run workflow** çalıştırılabilir; iş bitince sayfanın altındaki **lol-kumanda-windows** dosyası tek başına çalışan `lol-kumanda.exe`'dir (Node.js gerekmez). İmzasız olduğu için Windows "Bilgisayarınız korundu" derse **Ek bilgi → Yine de çalıştır**. Ayar dosyası exe'nin yanında oluşur.

### macOS / Linux

macOS'ta `baslat.command` dosyasına çift tıkla (ya da terminalde `npm install && npm start`). Linux'ta `npm install && npm start`.

---

## Kullanım

- **Ana ekran:** Lobi kur ya da var olan lobide **Sıraya gir**. Sıradayken süre görünür; **Sıradan çık** ile çıkarsın.
- **Maç bulundu:** Ekran büyük **KABUL ET** düğmesine geçer; telefon çalar ve titrer, geri sayım görünür.
  - Ses için sayfaya en az bir kez dokunmuş olman gerekir (tarayıcı kuralı). Ayarlar → **Uyarıyı dene**.
  - iPhone'da titreşim tarayıcılarda çalışmaz; sessiz anahtarı kapalıyken ses çalar.
- **Şampiyon seçimi:**
  - Üstte aşama (Planlama / Ban / Seçim / Son hazırlık) ve geri sayım, altında iki takım ve banlar.
  - Sıra sende değilken bir şampiyona dokunursan **niyet** olarak işaretlenir (takımın görür). Sıran gelince otomatik işaretli gelir; yalnızca **Kilitle**'ye basarsın.
  - Ban sırasında dokunduğun şampiyon istemcide de işaretlenir; **Banla** ile onaylarsın. Yanlışlıkla dokunmaya karşı her zaman iki adımlıdır.
  - Gri şampiyonlar o an seçilemez (sende yok, banlı ya da alınmış).
  - Onay çubuğundaki **☆** ile şampiyonu favorilere ekle (ban ve seçim favorileri ayrıdır).
  - **Büyü ve rün** sekmesi: D/F büyülerine dokunup değiştir; rün sayfanı seç.
- **Oyun bitince:** **Tekrar oyna** ile aynı lobiye dön.
- **Otomatik kabul:** Ana ekrandan ya da Ayarlar'dan açılır; gecikme 0–10 sn ayarlanabilir.

## Telegram bildirimi (önerilir)

Telefon kilitli ya da sayfa kapalıyken de haber almanın yolu budur. Bilgisayarın internete çıkabilmesi yeterlidir; port açmaya gerek yoktur.

1. Telegram'da **@BotFather**'ı aç, `/newbot` yaz, bota bir ad ve `..._bot` ile biten bir kullanıcı adı ver.
2. BotFather'ın verdiği anahtarı (`123456789:AA…`) kopyala.
3. LoL Kumanda'da **Ayarlar (⚙) → Telegram bildirimi** alanına yapıştır, **Kaydet**.
4. Çıkan **Telegram'da aç** bağlantısına dokun ve **Başlat**'a bas (ya da bota ekranda yazan `/start 123456` kodunu gönder). Eşleştirme tamam.

Bundan sonra:
- **Maç bulundu** mesajı gelir: **✅ Kabul et / ❌ Reddet** düğmeleri.
- **Ban/Seçim sırası sende** mesajında favori şampiyonların düğme olarak gelir; dokun → **Kilitle/Banla**. Ya da sadece şampiyon adını yaz (`ahri`, `mf`…).
- Komutlar: `/durum`, `/kabul`, `/reddet`, `/sira`, `/iptal`, `/sec Ahri`, `/ban Yasuo`, `/otokabul`, `/link`.

Bot yalnızca eşleştirdiğin sohbete cevap verir. Eski bildirimlerdeki düğmeler yeni maçta işe yaramaz.

## Ayarlar (`config.json`)

İlk açılışta programın klasöründe oluşur. Çoğu ayar telefondan da değiştirilebilir.

| Alan | Varsayılan | Açıklama |
|---|---|---|
| `port` | `4747` | Telefonun bağlandığı port |
| `token` | (rastgele) | Erişim anahtarı. Silersen yenisi üretilir; telefonda QR'ı yeniden taraman gerekir |
| `requireToken` | `true` | `false` yapılırsa anahtar sorulmaz (önerilmez) |
| `autoAccept` / `autoAcceptDelaySec` | `false` / `2` | Otomatik kabul ve gecikmesi |
| `leaguePath` | `""` | League kurulum klasörü; istemci bulunamıyorsa doldur. Ters bölü yerine `/` kullan: `"D:/Oyunlar/Riot Games/League of Legends"` |
| `favorites` | | `pick` ve `ban` şampiyon kimlikleri (telefondan yönetilir) |
| `telegram` | | Bot anahtarı ve eşleşen sohbet (telefondan yönetilir) |

Ortam değişkenleri: `PORT`, `LEAGUE_PATH`, `LCU_LOCKFILE`, `LOLK_CONFIG` (başka ayar dosyası), `LOLK_DEBUG=1` (ayrıntılı günlük).

## Sorun giderme

**Telefon sayfayı açamıyor**
- Telefon ve bilgisayar **aynı ağda** mı? Telefonda mobil veri değil Wi-Fi açık olmalı; VPN kapalı olmalı.
- Misafir (guest) Wi-Fi ağları cihazların birbirini görmesini engeller; ana ağa bağlan.
- Windows Güvenlik Duvarı: **`guvenlik-duvari-izni.bat`** dosyasını çalıştır (yönetici izni ister; 4747 portuna izin verir ve daha önce yanlışlıkla oluşan Node.js engelleme kurallarını kaldırmayı teklif eder).
- Pencerede birden çok adres yazıyorsa diğerlerini dene. Ağ profilin "Ortak" ise "Özel" yapmak da yardımcı olur.

**"League istemcisi bekleniyor" yazıyor**
- League istemcisi açık mı (Riot Client değil, League of Legends penceresi)?
- Oyun standart dışı bir klasördeyse `config.json` içinde `leaguePath` alanına kurulum klasörünü yaz.
- League yönetici olarak çalışıyorsa LoL Kumanda'yı da yönetici olarak çalıştırmayı dene.

**QR kod pencerede bozuk görünüyor** → Tarayıcıda `http://localhost:4747/qr` aç.

**Ses çalmıyor** → Sayfaya bir kez dokun; Ayarlar → **Uyarıyı dene**. Ekran kapanınca tarayıcı sayfayı uyutur: ekranı açık tut ya da Telegram bildirimini kullan.

**"4747 portu kullanımda"** → LoL Kumanda zaten açık olabilir; diğer pencereyi kapat ya da `config.json`'da `port` değiştir.

## Güvenlik ve gizlilik

- Sunucu yalnızca yerel ağda çalışır ve her istek için **erişim anahtarı** ister. Adresi (`?t=…`) kimseyle paylaşma.
- Yabancı alan adlarından gelen istekler reddedilir (DNS rebinding koruması).
- Hiçbir veri dışarı gönderilmez; yalnızca Telegram'ı açarsan bildirim mesajları Telegram'a gider.

## Riot Games hakkında

LoL Kumanda, League istemcisinin bilgisayarda açtığı **yerel API'yi (LCU)** kullanır: Blitz, Porofessor, U.GG gibi uygulamaların da kullandığı arayüzdür. Oyunun kendisine, belleğine ya da dosyalarına dokunmaz; senin yerine karar vermez, yalnızca istemcideki düğmelere telefondan basmanı sağlar. Bu API Riot tarafından resmi olarak desteklenmez; bir yamada değişebilir. Kullanım sorumluluğu sana aittir.

*LoL Kumanda, Riot Games tarafından onaylanmamıştır ve Riot Games'in ya da Riot Games mülklerinin yapımında veya yönetiminde resmî olarak yer alan herhangi birinin görüşlerini yansıtmaz. Riot Games ve ilgili tüm mülkler Riot Games, Inc.'in ticari markaları veya tescilli ticari markalarıdır.*

---

## Geliştirici notları

```
src/
  main.js            komut satırı girişi (QR, demo modu)
  app.js             parçaları birleştirir
  lcu/discovery.js   lockfile / işlem komut satırından port+şifre bulur
  lcu/client.js      LCU REST + WAMP websocket, otomatik yeniden bağlanma
  game/state.js      istemci durumu (olaylar + yoklama)
  game/view.js       telefona giden görünüm modeli (saf fonksiyonlar)
  game/actions.js    kabul, seçim, ban, büyü, rün, lobi… (doğrulamalı)
  web/server.js      HTTP sunucusu, SSE canlı akış, görsel vekili, /qr
  telegram/bot.js    isteğe bağlı Telegram botu
public/              telefon arayüzü (derleme adımı yok)
mock/                sahte League istemcisi ve sahte Telegram (demo + testler)
```

- `npm test` — birim + entegrasyon testleri (sahte istemci, HTTPS/WSS, yeniden bağlanma, Telegram akışı).
- `npm run test:e2e` — Playwright ile telefon boyutunda tarayıcı testi (Playwright kuruluysa).
- `npm run demo` — sahte istemciyle çalıştır. `node mock/mock-lcu.js` yalnız sahte istemciyi başlatır.
- `npm run build:exe` — tek dosya program (Node 22 + SEA). Windows'ta `dist/lol-kumanda.exe`.

Kullanılan LCU uç noktaları: `/lol-gameflow/v1/gameflow-phase`, `/lol-matchmaking/v1/ready-check/(accept|decline)`, `/lol-champ-select/v1/session`, `PATCH /lol-champ-select/v1/session/actions/{id}`, `POST …/actions/{id}/complete`, `/lol-champ-select/v1/(pickable|bannable)-champion-ids`, `/lol-champ-select/v1/session/my-selection`, `/lol-lobby/v2/lobby`, `/lol-lobby/v2/lobby/matchmaking/search`, `/lol-perks/v1/currentpage`, `/lol-game-data/assets/…`.
