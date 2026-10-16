# rg_ek1.tgz — ek Resmî Gazete metinleri (16 Ekim 2026)

Kullanıcının bilgisayarındaki oturumdan indirildi (bulut oturumu bu siteye erişemediği için):
- Arşivden 76 Gazete sayısı (`/Portals/105/...`; 2020/174 indirilemedi), 4 görüntü-PDF sayı (`/Portals/6/2025/230`, `2026/12`, `2026/79`, `2026/82`).
- Görüntü sayfaları (~520 sayfa) tarayıcıda yazı tanıma (tesseract.js, Türkçe) ile okundu.
- `ocr_yapildi.json` güncel hâlidir (yazı tanıma yapılan sayıların tam listesi).

Kullanım (kurulumdan sonra):
```bash
tar xzf asistan/raw/resmi_gazete/rg_ek1.tgz -C /home/claude/rg      # metin/ içine eklenir, ocr_yapildi.json güncellenir
cd /home/claude/kira_ai && python3 rg_dogrula.py && IKILI=0 ... (YAPILACAKLAR.md'deki akış) && python3 ikili_okuma.py
```
Ayrıca `rg_bol.py` + `rg_kaydet.py` yeniden çalıştırılırsa bu sayılardaki eşleşmeyen Gazete maddeleri de eklenebilir.
