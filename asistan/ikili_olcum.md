# İkili okuma kalite ölçümü (16 Ekim 2026)

`ikili_okuma.json` içindeki 4.094 kelime grubu değişikliğinden rastgele 200 tanesi (tohum 2026). Her satırda Yüksek Mahkeme
okuması (YM), Resmî Gazete okuması (RG, seçilen) ve çevresi var.

**Sonuç:** 200 örnekte 2 yanlış seçim (%1,0), 1 şüpheli (%0,5). Toplam en kötü durumda %1,5 → %2 sınırının altında,
kural (`sec = ...`) değiştirilmedi.

Görülen tek düzenli hata: "konmak" sözcüğünün Gazete'de "korunak" okunması (tüm değişikliklerde 8 kez). Sebep: birden çok
sözcüklü gruplarda ("paragrafi konmak") gruptaki bir sözcük bozuksa grubun tamamı değiştiriliyor; sağlam olan "konmak" da
gidiyor. İleride çok sözcüklü gruplarda sözcük sözcük seçim düşünülebilir.

| # | YM okuması | RG okuması (seçilen) | Karar | Çevre |
|---|---|---|---|---|
| 0 | elekirik | elektrik | doğru | Kurum tüketicisinin yenilenebilir enerji kaynaklarından [[ elekirik ]] üretmek için kurmuş olduğu tesisten |
| 1 | Kurut | Kurul | doğru | bir çoğunluk sağlanmaması halinde Genel [[ Kurut ]] toplantısı bir hafta sonra aynı |
| 2 | Sivi | Sivil | doğru | Savaş ve ve olağanüstü hallerde [[ Sivi ]] Savunma Teşkilat Başkanlığı tarafından Sivil |
| 3 | gida | gıda | doğru | tamamen GDO’lardan elde edilen gıdaların, [[ gida ]] katkı maddelerinin ve benzerleri. 9. |
| 4 | bususunda | hususunda | doğru | 850.- TL'yi geçmeyen bir mal [[ bususunda ]] tek bir muameleye ait olan |
| 5 | siniflar | sınıflar | doğru | Cetvel deki raklamlar ile ilgili [[ siniflar ]] ve her sınıfta yer alan |
| 6 | yasuda | yasada | doğru | Bağlayıcı niteliktedir, İtiraz Kurulu sekretaryası [[ yasuda ]] kendisine verilen görevlere bağlı olarak; |
| 7 | dahitinde | dahilinde | doğru | destek ödemesi yapılabilmesi için kapsam [[ dahitinde ]] olan sigortalı çalışanların işverenlerinin bu |
| 8 | ceze | ceza | doğru | ve erbaşların tabi olduğu. suç, [[ ceze ]] ve yargılama usulierine tabidirier, |
| 9 | şarilarına | şartlarına | doğru | Tüzük kapsamına giren ilgili sigorta [[ şarilarına ]] uygunluğu açısından degeriendirilerek askı listeleri |
| 10 | Motortu | Motorlu | doğru | Kayıt ve Ruhsat Harçları”, “(2) [[ Motortu ]] Araç Ruhsat Harçları” başlığı altında |
| 11 | flan | İlan | doğru | Kısa İsim 1. Amaç 2. [[ flan ]] ve 3. Yasaklama Yürürlükten 4. |
| 12 | Karmızı | Kırmızı | doğru | hizmetleri karşılığı 2.10 TL/m3 ~ [[ Karmızı ]] toprak için 8.70 TL/m? kaynak |
| 13 | Kabns | Kıbns | doğru | yabancı ülkelerdeki sigorta şirketlerinin Kuzey [[ Kabns ]] Türk Cumhuriyeti’ndeki şubelerini anlatır. “Sigorta |
| 14 | Gegici | Geçici | doğru | DÖRDÜNCÜ KISIM zs Son Kurallar [[ Gegici ]] Madde 1. (1) İlk uygulamada, |
| 15 | ötçüm | ölçüm | doğru | 2- Tesis ücreti içerisinde hat [[ ötçüm ]] ücreti dahildir. 3- Hat ölçüm |
| 16 | elekirik | elektrik | doğru | Cetvelde yer alan Tablo-l’de belirtilen [[ elekirik ]] alan şiddeti, manyetik alan şiddeti, |
| 17 | Adetl | Adet | doğru | - - - - Minibüs [[ Adetl ]] Muaf 10 1191 ÖLÇÜ VERGİ |
| 18 | belirülen | belirtilen | doğru | Tüzüğün oS'inci maddesinin (4Yüncü fıkrasında [[ belirülen ]] ekonomik koşullar ile (5Yinci Oo |
| 19 | medde | madde | doğru | anlaşma yapabilirler. (5) - Bu [[ medde ]] kuralları kapsamma giren duyurular, bir |
| 20 | hazıvlanan | hazırlanan | doğru | ve uygulamak: (H) “IFAB” tarafından [[ hazıvlanan ]] Futbol « Oyun 2 Kurallarina, |
| 21 | fikralarda | fıkralarda | doğru | ve aktarma ücretleri, (8) Yukarıdaki [[ fikralarda ]] belirtilenler dışmda kalan diğer gelirler, |
| 22 | demeğin | derneğin | doğru | dondurulur. Üyeliği dondurulan kulüp ve/veya [[ demeğin ]] yeniden üyeliğe başvurusu üç ay |
| 23 | eozaneleri | eczaneleri | doğru | düzenleyebilir ve bildiride saptanacak saatlerde [[ eozaneleri ]] açık ve kapalı tutmaya zorlayabilir. |
| 24 | paragrafi konmak | paragrafı korunak | yanlış: "konmak" doğru sözcük, "korunak" anlamsız | Maddesinin Değiştirilmesi aşağıdaki yeni giriş [[ paragrafi konmak ]] suretiyle değiştirilir: “ Ön lisans, |
| 25 | toplanuya | toplantıya | doğru | dayandırılmaksızın bir biri ardına üç [[ toplanuya ]] ve/veya bir yıl içerisinde yapılan |
| 26 | aşağida | aşağıda | doğru | (Değişiklik) Tüzüğü” olarak isimlendirilir ve [[ aşağida ]] “Esas Tüzük” olarak anılan “İlaç |
| 27 | tarafındarı | tarafından | doğru | yapmış olduğu işlere karşılık İdare [[ tarafındarı ]] yapılacak ödeme zaman ve kuralları. |
| 28 | malin | malın | doğru | (5) Lehinde ipotekli bulunan taşınmaz [[ malin ]] bir başka ipotekle teminat altına |
| 29 | balinde | halinde | doğru | sunulur. Yönetim Kurulunun uygun bulması [[ balinde ]] derhal Yetkili Makamlara iletilir. Rapor, |
| 30 | fikralarda | fıkralarda | doğru | İtfaiye kadrosunda görevli personelin aşağıdaki [[ fikralarda ]] belirtilen renk ve biçimde olmak |
| 31 | “Arty | "Artı | doğru | konmak Değiştirilmesi suretiyle değiştirilir: “ [[ “Arty ]] Puan” Yazılı Seçme Sınavında 600 |
| 32 | yılık | yıllık | doğru | Gerilim seviyesinin üzerinde olup ortalama [[ yılık ]] toplam elektrik tiketiminin (kWh) 1,2 |
| 33 | ilgiti hatlan kölü | ilgili hatları kötü | doğru | ve/veya kaçak olarak girmek ve/veya [[ ilgiti hatlan kölü ]] amaçlı otarak kullanmaktarı kesin suçlu |
| 34 | vapılacak | yapılacak | doğru | uygulamakla yetkilidir. (1) Daire ; [[ vapılacak ]] denetimlerde kat yakıtın torbalandığı, depolandığı, |
| 35 | fikralar | fıkralar | doğru | konmak ve ondan sonra gelen [[ fikralar ]] yeniden sayılandırılmak suretiyle değiştirilir: |
| 36 | SICIL | SİCİL | doğru | SONUÇ RAPORUİ(GSA). RÜTBE İSİM VE [[ SICIL ]] NO o :.............. eee een |
| 37 | değişürilmesi | değiştirilmesi | doğru | 52. maddenin değiştirilmesi 54, maddenin [[ değişürilmesi ]] 57. maddenin değiştirilmesi , Yürürlüğe |
| 38 | Isil | Isıl | doğru | (CxHy) Konsantrasyonu ve İslilik Derecesi [[ Isil ]] Güç Azotoksit \| Karbonmonoksit \| |
| 39 | elverişii | elverişli | doğru | gözleri; mantar miselleri Buket yapmaya [[ elverişii ]] veya süs amacına uygun kesme |
| 40 | kaışılığı | karşılığı | doğru | İzin Kurulu Sekreterliği tarafından imza [[ kaışılığı ]] ilgili kişiye veya birliğin komisyondaki |
| 41 | “Idari | "idari | şüpheli: büyük harf "İdari" küçüğe döndü | saatler için ödenen ücreti anlatır. [[ “Idari ]] Tatil”, resmi tatilden farklı olarak |
| 42 | catallanan | çatallanan | doğru | giden yoldan başlayarak daha sonra [[ catallanan ]] yolun sağından (Kuzeydeki) devam ederek |
| 43 | oşağıdaki | aşağıdaki | doğru | Basketbol Fedeseayonn t tarafindan hazırlanan [[ oşağıdaki ]] Tüzüğü onaylar: Kısa İsim Tefsir |
| 44 | hath dahılınde | hattı dahilinde | doğru | itibaren 100 metre eşdeğer mesafe [[ hath dahılınde ]] her türlü avcılık dönem boyunca |
| 45 | Gye | üye | doğru | sporsever, iyi ahlak sahibi, federasyona [[ Gye ]] kulüplerin ve/veya deneklerin yetkili kurullarında |
| 46 | antan | anılan | doğru | ve aşağıda "Esas Tüzük” olarak [[ antan ]] 1990 Sosyal Yardımlar Tüzüğü ile |
| 47 | kayıtit | kayıtlı | doğru | igili Bölüm Başkanına ve derse [[ kayıtit ]] öğrenciye yazılı olarak veya dersin |
| 48 | göte | göre | doğru | ilgili fiderin, Kurum tarafından analizlere [[ göte ]] belirleyeceği güneş enerji santrali kapasite |
| 49 | elekirikle | elektrikle | doğru | konmak suretiyle değiştirilir: “34. Sade [[ elekirikle ]] çalışan motorlu, motorsuz kara taşıtları, |
| 50 | cegit | çeşit | doğru | satan 168.- TL c) Her [[ cegit ]] akaryakıt satan İstasyon 493.- TL |
| 51 | tarihlen | tarihten | doğru | Bu Tüzük Resmi Gazete'de yayımlandığı [[ tarihlen ]] başlayarak Girişi yürürlüğe girer. |
| 52 | edilmeşi | edilmesi | doğru | protestonun not [[ edilmeşi ]] “asli nüshanın dosyalanması ve lüzumu |
| 53 | kaldinlmak | kaldırılmak | doğru | 4. Esas Emimame 4'üncü maddesi [[ kaldinlmak ]] ve yerine agagidaki yeni 4'üncü |
| 54 | ctki | etki | doğru | akaryakıt dolum ve depolama tesisleri [[ ctki ]] alanında uyulması gereken hava kalitesi |
| 55 | Sari | Sarı | doğru | ilk 6 asgari ücreti k) [[ Sari ]] Kum Her 6.500 m? ve/veya |
| 56 | Sehir | Şehir | doğru | ve/veya yenileme masrafını Belediyeye Teftiş [[ Sehir ]] Suyunun Durmasından Belediyenin Sorumluluğu Su |
| 57 | Cift | Çift | doğru | veya suni plastik maddelerden ayakkabılar [[ Cift ]] Muaf 13 - Diğer ayakkabılar |
| 58 | Obalımından | bakımından | doğru | 26/2013 ©) Bu madde amaçları [[ Obalımından ]] işyerlerindeki çalışan sayısı değerlendirilirken, 13 |
| 59 | Yeten | Yeterli | doğru | yen ve kültürel alanlar : [[ Yeten ]] Sosyal aktivite olanakları. 1 ve |
| 60 | smavların | sınavların | doğru | bir not almış olmak. Ek [[ smavların ]] sonucunda bu öğrencilerin başarı durumları |
| 61 | Ydk | Yük | doğru | suretiyle değiştirilir: “3 Konteynerler: (a) [[ Ydk ]] ihtiva eden konteyner beher gün |
| 62 | çıkınası hâlinde, | çıkması halinde, | doğru | olacak nitelikte bir mazeretlerinin ortaya [[ çıkınası hâlinde, ]] bu mazeretlerini, varsa belgeleyen evrakla |
| 63 | BUYAZ | BEYAZ | doğru | w LÜBNAN 961 TAJİKIŞTAN {992 [[ BUYAZ ]] RUSYA 375 HONGKONG LE MALEZYA |
| 64 | sre | süre | doğru | bulunan Şatıs ve/veya şahıslardan bu [[ sre ]] içerisinde yaptıkları görüşme ücretlerinin tesbit |
| 65 | maddeşinin | maddesinin | doğru | Esas Tüzük, 45 A [[ maddeşinin ]] mevcut kuralları (IY'inci fıkra olarak |
| 66 | masraflarım | masraflarını | doğru | diğer servisler ve işlerin işçilik [[ masraflarım ]] Belediyeye ödemekle yükümlüdür. (2) Yukanda |
| 67 | Jegerlendirme | değerlendirme | doğru | Kuzey Kıbrıs Türk Cumhuriyetinde uygunluk [[ Jegerlendirme ]] faaliyeti yürüten şube, temsilcilik veya |
| 68 | Higbir | Hiçbir | doğru | v.b. Koşullar ve Kısıtlamalar 1) [[ Higbir ]] reklam 2.40 metrekareden büyük olamaz. |
| 69 | Uretim | Üretim | doğru | bilgi edinir. Bu bilgiler; (a) [[ Uretim ]] süreci konusunda bütün belgeleri ve |
| 70 | atmayan | almayan | doğru | içerisinde Belediyenin yasal ihbarını dikkate [[ atmayan ]] tüketicilerin bahse konu engelleri Belediye |
| 71 | Yul | Yıl | doğru | Adet Motosikletli Polis Kıyafeti 3 [[ Yul ]] 1 Set 1 Set Bot |
| 72 | dizenleneoek | düzenlenecek | doğru | ha in, eg faaliyetler ve [[ dizenleneoek ]] her türlü spor aktivitelerin işleyişinden |
| 73 | (toplem | (toplam | doğru | ilavesi suretiyle bulunan toplam ile [[ (toplem ]] gelir) cari yıl komisyonu, cari |
| 74 | irafiği, | trafiği, | doğru | hava yolu trafiği, deniz yolu [[ irafiği, ]] sanayi tesisleri ve eğlence mekanlarından |
| 75 | özelikler | özellikler | doğru | olmadığı halde birtakım etkiler veya [[ özelikler ]] varmış gibi veya benzer yemler |
| 76 | takdizde; | takdirde; | doğru | esası kıymetin bir yüzdeliği olduğu [[ takdizde; ]] ücretin bir kısmı ödenir. İhracatın |
| 77 | İştetilmesi | İşletilmesi | doğru | Kuruluş Yeri, A.E 54 Ölçümleri, [[ İştetilmesi ]] ve Denetlenmesi Tüzüğü” ile birlikte |
| 78 | MUNHASIRAN | MÜNHASIRAN | doğru | GRUP I. KENT VE KASABALARDA [[ MUNHASIRAN ]] SERBEST MESLEK FAALIYETI VE ESNAFLIK |
| 79 | baş! Ücreli | başı ücreti | doğru | telefon ve data trafiğinin dakika [[ baş! Ücreli ]] 0.06 Amerikan Dolarıdır (6 cent/dk}. |
| 80 | taahhiimame | taahhütname | doğru | uygun tesis kurulacağına ilişkin yazılı [[ taahhiimame ]] Verilmesi (H) Ana tesisin kurulacağı |
| 81 | dina | adına | doğru | bir kulüp Oo ve/veya demek [[ dina ]] Federasyona lisanslı sporcu olarak kayıt |
| 82 | Kıbus | Kıbrıs | doğru | sunulan sütü anlatır. “İmalatçı” Kuzey [[ Kıbus ]] Türk Cumhuriyeti sınırları içerisinde Süt |
| 83 | Yöncüm | Yönetim | doğru | bir Akademik Değerlendirme Komisyonu üyesi, [[ Yöncüm ]] Kurulu tarafından belirlenen formata uysun |
| 84 | kınık | kırık | doğru | avcılar, tüfeklerini araçlarının bagajlarında ve [[ kınık ]] olarak bulunduracaklardır. Avcıların avlanırken hedefini |
| 85 | bendinir | bendinin | doğru | kabiliyetini doğrulamak amacıylabu maddenin (A) [[ bendinir ]] (d) numaralı alt bendinde atıf |
| 86 | vapmak | yapmak | doğru | kurulacak tesislerin imalatını veya müteahhitliğini [[ vapmak ]] veya bu tesislerin kuruluşunda herhangi |
| 87 | bulunanı | bulunan | doğru | Telefon/Teleks tesis ve nakil talebinde [[ bulunanı ]] bir kimse talepden sonra adres |
| 88 | Programım | Programın | doğru | kesiminden önce düzenlenerek ilgililere duyurulur. [[ Programım ]] bir örneği, ilgili Öğretim Dairesi |
| 89 | tarafndan | tarafından | doğru | tarafından hazırlanacak ve Bakanlar Kurulu [[ tarafndan ]] onaylanıp, Resmi Gazete'de yayımlanacak; KIMMOB |
| 90 | kloriir | klorür | doğru | Havada Asılı Toz 0,08 Hidrojen [[ kloriir ]] ( Cl olarak 0,1 gösterilmiştir. |
| 91 | Uretici, | Üretici, | doğru | güvencesine dayalı tipe uygunluk (2) [[ Uretici, ]] sözkonusu ü; ünlerin bitmi ürün |
| 92 | mahküm | mahkum | doğru | Usulü Yasasının VII Kısmı uyarınca [[ mahküm ]] edilen hükümlü borçluların iaşe ve |
| 93 | tıkdirde, | takdirde, | doğru | Denetim esnasında yetkili otorite, gerektiği [[ tıkdirde, ]] yurt dışında yerleşik onaylanmış kuruluş |
| 94 | Kubrıs | Kıbrıs | doğru | kapalı tutmaya zorlayabilir. Ayrıca bildiri [[ Kubrıs ]] Türk Eczacılar Birliği Yönetim Kurulu'nun |
| 95 | demekler; | dernekler; | doğru | Çarptırılan Sorumlulukları (i) (Kulüpler veya [[ demekler; ]] yöneticilerine, antrenörlerine ve sporcularına verilen |
| 96 | tesvik | teşvik | doğru | Bu fikra kapsamında işverenlere yapılacak [[ tesvik ]] ödemesinden yararlandırılacak Kuzey Kıbrıs Türk |
| 97 | Ikamet icin | İkamet için | doğru | (B) Ek İnşaatlar İçin:- (a) [[ Ikamet icin ]] yapılan binalar: (i) 0-120 metre |
| 98 | kullandacak | kullanılacak | doğru | Su ürünleri yetiştiriciliğinde [[ kullandacak ]] mallar, av araç ve gereçleri; |
| 99 | uliesi | ailesi | doğru | görev gereğince şahsı Zorunlu ve [[ uliesi ]] (eş ve çocuk) için vize |
| 100 | üçretsiz | ücretsiz | doğru | çok beş Telekomünikasyon Dairesi personeline [[ üçretsiz ]] olarak tamamen servis amaçtı AOSL |
| 101 | yetlerin | faaliyetlerin | doğru | faaliyeti için. alternatif çözümler üretmesini [[ yetlerin ]] önceliklerini saptayarak planlama yapmasını ve |
| 102 | vetilecek | verilecek | doğru | tondan fazla olan ürünler için [[ vetilecek ]] olan Bitki Sağlık Sertifikası Harcı |
| 103 | arasi | arası | doğru | 9- 200,000.00 TL- 400,000.00 TL [[ arasi ]] 4.885,00 10-400,000,00 TL - 600,000.00 |
| 104 | Curahuriyeti | Cumhuriyeti | doğru | Yapılan Tüzük Kuzey Kıbrıs Türk [[ Curahuriyeti ]] Bakanlar Kurulu, Fasil 286 Cezaevi |
| 105 | Ruhsatin | Ruhsatın | doğru | aşağıdaki kira bedelleri ödenir. - [[ Ruhsatin ]] ilk yılı için her km |
| 106 | Teftise | Teftişe | doğru | Kuru Baharat Otları: 1880 - [[ Teftise ]] sunulan her 50 kilo veya |
| 107 | suretie, | surette, | doğru | şirketlerce herhangi bir şekil ve [[ suretie, ]] nakden veya hesaben teşvik komisyonu |
| 108 | Adeti Muat | Adet Muaf | doğru | 8703.90.90.00.00 \| - - Diğerleri [[ Adeti Muat ]] 10 87.04 Eşya taşımaya mahsus |
| 109 | sistemteri | sistemleri | doğru | ve KKTC telefon santralları ile [[ sistemteri ]] kullanılarak yapılar transit telefon görüşmelerini |
| 110 | Kıbus | Kıbrıs | doğru | İzleme Komitesi'ni anlatır. “Federasyon”; Kuzey [[ Kıbus ]] Türk OCumhuriyei Kickboks Federasyonu'nu anlatır. |
| 111 | (okapsamındaki | kapsamındaki | doğru | iletilmesi zorunludur. Ancak bu fıkra [[ (okapsamındaki ]] kurallar, son dakika rezervasyonlarının ve |
| 112 | vir | bir | doğru | bir test düzeneğinde veya her [[ vir ]] kazan için kurulu durumdaki bir |
| 113 | sigortali | sigortalı | doğru | haciz konulamaz. Ancak, Sigorta Yöneticisinin [[ sigortali ]] alacaklarının korunması amacıyla teminatlar üzerinde |
| 114 | sinava | sınava | doğru | adayı yasal şoför okulu aracıyla [[ sinava ]] girmeye mecburdur. Ancak Motorlu Araçlar |
| 115 | aşağıdakı | aşağıdaki | doğru | uygunluk göstermesi gereken ölçüm sonuçları, [[ aşağıdakı ]] koşullarda standart hale getirilir: Sıcaklık |
| 116 | çalışurma | çalıştırma | doğru | TL'dır. Ancak bir telsiz cihazı [[ çalışurma ]] ruhsatının ilk yıl yılın ilk |
| 117 | işağıdaki | aşağıdaki | doğru | icerisindeli zararın Tazminatın tazmini için [[ işağıdaki ]] kurallar uygulanır, Hesaplanması ve (1) |
| 118 | eMüracaat | Müracaat | doğru | YERİ İLE İLGİLİ BİLGİLER : [[ eMüracaat ]] sahibinin... köyünde İkamet etmeğe başladığı |
| 119 | alinmaz. | alınmaz. | doğru | . miitebaki tonaj ederi dikkate [[ alinmaz. ]] ; — Yürürlükten Kalkış 19. |
| 120 | antatir: | anlatır: | doğru | bulunan gerçek ve tüzel kişileri [[ antatir: ]] “Üretici Kayıt Defteri”, Üreticinin kimlik, |
| 121 | ayık | aylık | doğru | Komutanlık kontenjan sınırları içinde kalan [[ ayık ]] görüşmeler için herhangi bir ücret |
| 122 | Veriten | Verilen | doğru | Arızalı veya Manevradan Yoksun Gemilere [[ Veriten ]] Kılavuzluk Ücretleri Fasıl 294 |
| 123 | almır: | alınır: | doğru | ve aşağıda belirtilen miktarlarda resim [[ almır: ]] (A) 1 m”yi aşmayan bildiri |
| 124 | Kuruu | Kurulu | doğru | ve Makina Mühendisleri Odası Yönetim [[ Kuruu ]] tarafından kendilerine verilen meslek ile |
| 125 | degeriendirilerek | değerlendirilerek | doğru | ilgili sigorta şarilarına uygunluğu açısından [[ degeriendirilerek ]] askı listeleri hazırlanır. Köy bazında |
| 126 | tahsit | tahsil | doğru | üzerinde olan görüşmelerin ücreti tümüyle [[ tahsit ]] edilir. Beyaz basın kartı sahibi |
| 127 | gürülü | gürültü | doğru | meydana gelen çevresel gürültüye ilişkin [[ gürülü ]] göstergeleri sınır değerleri verilmektedir. Bu |
| 128 | Tatısili | Tahsili | doğru | tüzel kişiler hakkında Kamu Alacakları [[ Tatısili ]] Usulü Yasası uyarınca işlem yapılır. |
| 129 | inaddeler | maddeler | doğru | bir kuvvet kullanılan veya parlayıcı [[ inaddeler ]] kullanılan herhangi bir fabrika için |
| 130 | Ulkeye | Ülkeye | doğru | (FOB) (CF) ; (CIF) 4. [[ Ulkeye ]] getirilmesi garanti edilen kiymet : |
| 131 | Teftise | Teftişe | doğru | _ - İthal edilen ve [[ Teftise ]] sunulan tüm çeşitlerin toplamının her |
| 132 | fisans | lisans | doğru | ferdi lisans sahibi sporcular için [[ fisans ]] başvurusunda bulunabilirler. Bu sporcuların ligde |
| 133 | fıyat | fiyat | doğru | Yukarıda belirlenen paylar(fire,masraf kar) tavan [[ fıyat ]] dikkate alınarak akaryakıtın azami pompa |
| 134 | tahzim | tanzim | doğru | “ Klasik Araç Kimlik Kartı” [[ tahzim ]] edemez. Klasik araç kimlik kartı |
| 135 | fikraya | fıkraya | doğru | göre belirlenemezse dava harcı 7. [[ fikraya ]] göre tahsil edilir ve hüküm |
| 136 | UCRETLERI | ÜCRETLERİ | doğru | ve 81) AMBAR VE ANTREPO [[ UCRETLERI ]] 1. İthalde malların onanmış gümrük |
| 137 | gerektirmedikce; | gerektirmedikçe; | doğru | Bu Tüzükte metin başka türlü [[ gerektirmedikce; ]] “Akaryakıt İstasyonu”, Esas itibarıyla karayolunda |
| 138 | olacakur. | olacaktır. | doğru | asgari bir adet emniyet subabı [[ olacakur. ]] Bu valfın açılma taziği tankın |
| 139 | elektirik | elektrik | doğru | talep edilebilir. Yenilenebilir enerji kaynağından [[ elektirik ]] ve 1sı enerjisi üretmek |
| 140 | sürg | süre | doğru | para alma hakkı vardır. Bu [[ sürg ]] sözleşmeyle kısaltılabilir. LL. En az |
| 141 | içir | için | doğru | verilen 1'den fazla ber Şehit [[ içir ]] aylık yardıma 118,62 .-YTL ilave |
| 142 | Degerlendinme | Değerlendirme | doğru | Planı, kamu görevlisi ile Birinci [[ Degerlendinme ]] Amiri arasında mutabakata varılarak en |
| 143 | getekli | gerekli | doğru | ve Resmi Gazetede yayınlanıncaya kadar [[ getekli ]] görülen bütün konularda ve komite |
| 144 | Kibris | Kıbrıs | doğru | değiştirilir: Maddesinin Değiştirilmesi “() Kuzey [[ Kibris ]] Türk Cumburiyeti Bayrağına geçmesi durumunda, |
| 145 | Teftiste | Teftişte | doğru | kilosu veya kısmı için - [[ Teftiste ]] red edilen veya tekrar teftiş |
| 146 | “tarihiiğen | tarihinden | doğru | istenen’ i kendisine yapılan tebliğ [[ “tarihiiğen ]] başlayarak en geç durüğirlanın (oturumun |
| 147 | elekirik | elektrik | doğru | ifade eder. “Kurum Tüketicileri”, Kurum'un [[ elekirik ]] enerjisi sağladığı tüm aboneleri kapsar. |
| 148 | oşekilde | şekilde | doğru | hizmet süreçlerinin Otümünü de kapsayacak [[ oşekilde ]] uygulamacı üye ve işveren arasında |
| 149 | slnıflandırılan | sınıflandırılan | doğru | A ve Cetvel B olarak [[ slnıflandırılan ]] ve aşağıaki (1). ve (2). |
| 150 | fikralan konmak | fıkraları korunak | yanlış: "konmak" → "korunak" | aşağıdaki yeni Değiştirilmesi (a)ve (b) [[ fikralan konmak ]] suretiyle değiştirilir: “(a) Her Konuttan; |
| 151 | Teftise | Teftişe | doğru | veya kısmı için \| iv) [[ Teftise ]] sunulan veya tekrar teftiş edilen |
| 152 | belirilen | belirtilen | doğru | olarak yayımlanan dokümanların son şeklinde [[ belirilen ]] tüm standart ve tavsiyelerde belirtilen |
| 153 | oOhariç, | hariç, | doğru | Birinci Sütun Poliçe (o protestosu [[ oOhariç, ]] herhangi bir |
| 154 | şetiir | şehir | doğru | Bakanın onayına sunutur. Ancak, büyük [[ şetiir ]] belediye sınırları dışında kalan kırsal |
| 155 | kisdere amatér | kişilere amatör | doğru | kapsamı dışmda kalan yabanci uyruklu [[ kisdere amatér ]] balıkçılık belgesi verimez. Su kişiler |
| 156 | ““Sper | "Spor | doğru | Lisans ve Aktarma Komitesi'ni anlatır. [[ ““Sper ]] Derneği”; Değiştirilmiş halindeki 6/1961 sayılı |
| 157 | Okatılımcı | katılımcı | doğru | ile bir veya birden fazla [[ Okatılımcı ]] arasında, belirli bir zaman aralığında |
| 158 | kat alinur. | katı alınır. | doğru | aylık hat kira ücretlerinin 2 [[ kat alinur. ]] 2- Tesis ücreti içerisinde hat |
| 159 | BINALARI DUZENLEME | BİNALARI DÜZENLEME | doğru | yapılan . . YOL VE [[ BINALARI DUZENLEME ]] YASASI (DEĞİŞİKLİK) TÜZÜĞÜ Kısa İsim |
| 160 | Sayisal | Sayısal | doğru | ağırlığı 1) Sözel WTS 2) [[ Sayisal ]] %25 a) Sözcük bilgisi %15 |
| 161 | tahtinda | tahtında | doğru | 117.- 85.- 46- K.K.T.C.Evlendirme kanunu [[ tahtinda ]] tesit edilen evlenmeyi resmen icra |
| 162 | gift | çift | doğru | haberleşme sağlayıcısına, verdiği bükümlü metalik [[ gift ]] yerel ağa ayrık erişim hizmetleri |
| 163 | zaratları, | zararları, | doğru | gelen zararları; (E) Seralarda oluşan [[ zaratları, ]] (F) Seranın zarar görmesi neticesinde |
| 164 | hatti | hattı | doğru | coğrafi koordinatları, 1) Taksiyolu merkez [[ hatti ]] noktalarının coğrafi Koordinatları, ii) Her |
| 165 | sira | sıra | doğru | ilan ve reklamlarda oranının yanı [[ sira ]] eğer varsa; (A) Toplam kredi |
| 166 | antlan | anılan | doğru | ve aşağıda “Esas Tüzük” olarak [[ antlan ]] Atatürk Öğretmen Akademisi Ek Çalışma |
| 167 | Milk | Milli | doğru | Milli Arşiv ve Araştırma Dairesi, [[ Milk ]] Arşiv Kurulu Çalışma Esasları ve |
| 168 | Teftise | Teftişe | doğru | - İthal edilen ve tekrar [[ Teftise ]] sunulan tüm çeşitlerin toplamının her |
| 169 | ayri | ayrı | doğru | veya tasdik edilmesi: (i) Her [[ ayri ]] vesika ve dosyalanan Süret için |
| 170 | kaldırılımak | kaldırılmak | doğru | (J “inci fikvasının) (B) bend [[ kaldırılımak ]] ve yerine aşağıdaki yeni (B) |
| 171 | mütcakip | müteakip | doğru | Şirketler Mukayyitliği nezdinde kuruluşunu tamamlamasını [[ mütcakip ]] finansal kiralama şirketleri; (A) Faaliyet |
| 172 | kapsaminda; | kapsamında; | doğru | hizmetleri ücretlidir. e Premium paket [[ kapsaminda; ]] o Aylık raporlama, 1 adet |
| 173 | kişler | kişiler | doğru | KKTC vatandaşı gerçek [[ kişler ]] amatör balıkçılık faaliyetlerinde bulunabilmeleri için, |
| 174 | Kibrıs | Kıbrıs | doğru | 34 altında yapılan Tüzük Kuzey [[ Kibrıs ]] Türk Cumhuriyeti Bakanlar Kurulu, Gümrük |
| 175 | Alun, | Altın, | doğru | bakır - Bakır konsantreleri - [[ Alun, ]] Gümüş, kobalt ve Nikel ihtiva |
| 176 | eridüstriyel | endüstriyel | doğru | (madenler, inşaat sahaları ve diğer [[ eridüstriyel ]] alanlar) kullanılan koruyucu baretler, - |
| 177 | ‘aide | halde | doğru | iki kat olarak alınır. Her [[ ‘aide ]] bu ücret 0.60 Y.Kr'dan az |
| 178 | (Fasil | (Fasıl | doğru | Sayı: 847 CEZAEVİ DİSİPLİN YASASI [[ (Fasil ]] 286, 48/1995) Madde 4 ve |
| 179 | Kubrs | Kıbrıs | doğru | sporcuyu anlatır. “Teknik Komite”, Kuzey [[ Kubrs ]] Türk Cumhuriyeti Kickboks Federasyonu Teknik |
| 180 | endüsiriyel, | endüstriyel, | doğru | (peyzajların) korunup- geliştirilmesi, kentsel, kırsal, [[ endüsiriyel, ]] turistik ve benzeri kullanımlarında mevcut |
| 181 | geliştürilmesi, | geliştirilmesi, | doğru | ve yaban hayvanlarımın bakımı, korunması, [[ geliştürilmesi, ]] gözlemlenmesi ve sayımıyla bu konuda |
| 182 | Yasanin | Yasanın | doğru | Ancak, (¢) bendi uyarinca bu [[ Yasanin ]] yürürlüğe girdiği tarihten önce gümrükleme |
| 183 | Ermanet | Emanet | doğru | iki yıl süre ile olur, [[ Ermanet ]] süresi sonunda KISIM Vİ Madde |
| 184 | “Ving | "Vinç | doğru | Esas Tüzük ekli Vinci Cetvel'in [[ “Ving ]] ve forklift ücretleri A. maddesi |
| 185 | kaldinlmak | kaldırılmak | doğru | Esas Tüzük, 120’nci maddesi tamamen [[ kaldinlmak ]] suretiyle değiştirilir: |
| 186 | toplamtıda | toplantıda | doğru | toplantı yeter sayısı üçtür. Kararlar [[ toplamtıda ]] hazır bulunan üyelerin salt çoğunluğuyla |
| 187 | içir | için | doğru | olmak ; (6) Profesörlüğe atanmak [[ içir ]] başvuru yapan adaylar aşağıdaki belgeleri |
| 188 | Kabris | Kıbrıs | doğru | 86 Altında Yapılan Tüzük Kuzey [[ Kabris ]] Türk Cumhuriyeti Bakanlar Kurulu, Kamu |
| 189 | Aytık | Aylık | doğru | ücreti : 1500 YTL 1.2- [[ Aytık ]] sabit ücret : 200 YTL |
| 190 | demekler | dernekler | doğru | tarihine kadar, ilgili kulüp ve [[ demekler ]] tarafından Federasyon saymanlığına yatırılmalıdır. |
| 191 | karts | kartı | doğru | tanzim edilemez. Klasik araç kimlik [[ karts ]] bir takvim yılı için geçerlidir |
| 192 | Teftise | Teftişe | doğru | - İthal edilen ve tekrar [[ Teftise ]] sunulan her ton veya kısmı |
| 193 | fikrasının | fıkrasının | doğru | şekliyle 17’nci maddenin (1) inci [[ fikrasının ]] (D) bendi kuralları 1 Ocak |
| 194 | editen | edilen | doğru | Yeni Türk Lirası cinsinden tesbit [[ editen ]] fiyatlar 2 ay boyunca geçerli |
| 195 | eşva | eşya | doğru | kargo ve yolcu beraberi ticari [[ eşva ]] işlemlerinden fazla mesai ücretleri tahsil |
| 196 | orcalama | ortalama | doğru | mW/} MHz dir. ıW TSEN [[ orcalama ]] 301893 erp Maksimum ortalama Bina |
| 197 | arasinda | arasında | doğru | Silindir kapasitesi 126cc ile 249cc [[ arasinda ]] olan (126cc ve 249cc dahil) |
| 198 | teftig | teftiş | doğru | ilgili evrakın her teftişi için, [[ teftig ]] süresinin her saati veya her |
| 199 | tibbi arnaçlı | tıbbi amaçlı | doğru | minderleri, oturma minderleri, destek yastıkları, [[ tibbi arnaçlı ]] beslenme solüsyonları vb. dahil); Gümrük |
