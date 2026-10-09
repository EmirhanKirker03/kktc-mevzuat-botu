"""KKTC Kira (Denetim) Yasası veri setini resmî Meclis metinlerinden oluşturur.

Metinler değiştirilmez (OCR hataları dahil). Her madde, kaynağındaki konumuyla birlikte
saklanır; değişiklik yasalarındaki yeni hükümler de kaynak metinden birebir kesilir.
"""
import json, re, hashlib, os

RAW = os.path.join(os.path.dirname(__file__), "raw")
SOURCE = "KKTC Cumhuriyet Meclisi yasa arşivi (cm.gov.ct.tr/Yasalar)"
FETCHED = "2026-10-09"

def read(name):
    return open(os.path.join(RAW, name + ".txt"), encoding="utf-8").read()

base = read("17-1981")
amend = {k: read(k) for k in ["22-1981", "35-1982", "48-1983", "27-2011"]}

# (madde no, başlık, kaynaktaki başlangıç işareti)
MARKERS = [
    ("1", "Kısa isim", "Kısa isim.l."),
    ("2", "Tefsir (tanımlar)", "Teafsir.2."),
    ("3", "Yasanın uygulanması ve denetim bölgelerinin saptanması", "Yasanın uygulanması ve Denetim bölgelerinin saptanması.3."),
    ("4", "Yargılama usulü", "Yargılama usulü.4."),
    ("5", "Mahkeme kararlarının gözden geçirilmesi", "Mahkeme kararlarının gözden geçirilmesi.5."),
    ("6", "Taşınmaz mal kiralarının saptanması", "Taşınmaz mal kiralarının saptanması.6."),
    ("7", "Tahliye sebepleri", "Tahliye sebepleri.7."),
    ("8", "Bazı hallerde kiracıya tazminat ödenmesi", "Bazı hallerde kiracıya tazminat ödenmesi.8."),
    ("9", "Bazı hallerde yeniden kira ilişkisi kurulması", "Bazı hallerde kiracı ile kiralayan arasında yeniden kira ilişkisinin kurulması.9."),
    ("10", "Hüküm veya emrin yanıltma ile elde edilmesi", "Hüküm veya emrin yanıltma ile elde edilmesi.10."),
    ("11", "Mahkemenin şart koşma yetkisi", "Mahkemenin şart koşma yetkisi.11."),
    ("12", "Yasal kiracılık şartları", "Yasal kiracılık şartları.I2."),
    ("13", "Tasarruf emrinin kiracının kiracısı üzerindeki tesirleri", "Tasarruf emrinin kiracının kiracısı üzerindeki tesirleri.13."),
    ("14", "İhbarların tebliği", "İhbarların tebliği.l4."),
    ("15", "Sözleşmeler (fahiş kira)", "Sözleşmeler.15."),
    ("16", "Yürürlükten kaldırma", "Yürürlükten kaldırma."),
    ("17", "Kira bakiyelerinin dondurulması", "Kira bakiyelerinin dondurulması.l7."),
    ("Geçici 1", "Geçici madde 1", "Geçici madde.l."),
    ("Geçici 2", "Geçici madde 2", "Geçici madde.2."),
    ("18", "Yürürlüğe giriş", "Yürürlüğe giriş.18."),
]

PART_HEAD = re.compile(r"(BlRİNCİ|BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ|ALTINCI|YEDİNCİ)\s+KISIM[\s\S]*$")

def slice_between(text, start, end):
    i = text.index(start)
    j = text.index(end, i + len(start)) if end else len(text)
    return text[i:j]

positions = []
for no, title, mk in MARKERS:
    assert base.count(mk) == 1, (no, mk, base.count(mk))
    positions.append(base.index(mk))
assert positions == sorted(positions), "Madde sırası bozuk"

def cut(text, start, end, include_end=False):
    """Kaynaktan birebir kesit; başlangıç/bitiş işaretleri tek olmalı."""
    assert text.count(start) == 1, start
    i = text.index(start)
    j = text.index(end, i) + (len(end) if include_end else 0)
    return text[i:j]

articles = []
for k, (no, title, mk) in enumerate(MARKERS):
    s = positions[k]
    e = positions[k + 1] if k + 1 < len(MARKERS) else len(base)
    raw = base[s:e]
    body = raw[len(mk):]
    body = PART_HEAD.sub("", body).strip()
    articles.append({
        "id": "17-1981:" + no.replace(" ", ""),
        "law": "17/1981 Kira (Denetim) Yasası",
        "no": no,
        "title": title,
        "text": body,
        "source_offset": s,
        "amendments": [],
        "status": "yürürlükte",
    })

A = {a["no"]: a for a in articles}

def add(no, law, what, new_text=None):
    A[no]["amendments"].append({"law": law, "change": what, "new_text": new_text})

a22, a35, a48, a11 = amend["22-1981"], amend["35-1982"], amend["48-1983"], amend["27-2011"]

add("2", "22/1981 Kira (Denetim) (Değişiklik) Yasası",
    "“Yasal kiracı” tanımının sonuna ek yapıldı.",
    cut(a22, "“Ve bu Yasanın Altıncı Kısmındaki", "kapsar.”", True))
add("Geçici 1", "22/1981 Kira (Denetim) (Değişiklik) Yasası",
    "Geçici madde 1 kaldırıldı ve yerine yenisi kondu.",
    cut(a22, "1.(a)Bu Yasa Kuralları", "hak kazanırlar.", True))
add("6", "35/1982 Kira (Denetim) (Değişiklik No: 2) Yasası",
    "6. maddeye yeni (3). fıkra eklendi (görevli yargıç).",
    cut(a35, "\"(3).  Bu ve 15. madde", "yargıcı anlatır \".", True))
add("6", "48/1983 Kira (Denetim) (Değişiklik) Yasası",
    "6. maddeye yeni (4). fıkra eklendi: yeni kira karar tarihinden geçerli. (27/2011 ile değiştirildi.)",
    cut(a48, "“(4)Mahkemenin", "geçerlilik kazanır “", True))
add("4", "27/2011 Kira (Denetim) (Değişiklik) Yasası",
    "4(1) değiştirildi (dava en geç 3 ayda karara bağlanır) ve yeni 4(3) eklendi (istinaf en geç 3 ayda).",
    cut(a11, "“(1)Bu Yasa kuralları uyarınca açılacak", "karara bağlanır.” \n", True).strip())
add("6", "27/2011 Kira (Denetim) (Değişiklik) Yasası",
    "6(4) değiştirildi: mahkemenin saptadığı yeni kira İSTİDA (başvuru) tarihinden itibaren geçerli.",
    cut(a11, "“(4)Mahkemenin, yukarıdaki", "geçerlilik kazanır.”", True))
add("7", "27/2011 Kira (Denetim) (Değişiklik) Yasası",
    "7(1)(A),(B),(F),(G),(I) bentleri ve 7(2) değiştirildi (ör. kira bir hafta içinde ödenmezse tahliye; erteleme en fazla üç ay; tadilat ihbarı en az bir ay).",
    cut(a11, "“(A)Kanunen ödenmesi", "tehir edebilir.”", True))
add("8", "27/2011 Kira (Denetim) (Değişiklik) Yasası", "8. madde KALDIRILDI.")
add("9", "27/2011 Kira (Denetim) (Değişiklik) Yasası", "9. madde KALDIRILDI.")
A["8"]["status"] = "kaldırıldı (27/2011)"
A["9"]["status"] = "kaldırıldı (27/2011)"
add("15", "27/2011 Kira (Denetim) (Değişiklik) Yasası",
    "15. madde tamamen yeniden yazıldı: kiracı fahiş kira için, mal sahibi alenen düşük kira için sözleşme bitmeden mahkemeye başvurabilir.",
    cut(a11, "“Sözleşmeler 15.(1)", "taşınmaz mallara uygulanır.”", True))
A["7"]["status"] = "yürürlükte (27/2011 ile değişik)"
A["15"]["status"] = "yürürlükte (27/2011 ile değişik)"
A["6"]["status"] = "yürürlükte (35/1982, 48/1983, 27/2011 ile değişik)"
A["4"]["status"] = "yürürlükte (27/2011 ile değişik)"

laws = [
    {"no": "17/1981", "name": "Kira (Denetim) Yasası", "role": "esas yasa", "passed": "14 Nisan 1981"},
    {"no": "22/1981", "name": "Kira (Denetim) (Değişiklik) Yasası", "role": "değişiklik", "passed": "15 Eylül 1981"},
    {"no": "35/1982", "name": "Kira (Denetim) (Değişiklik No: 2) Yasası", "role": "değişiklik", "passed": "16 Kasım 1982"},
    {"no": "48/1983", "name": "Kira (Denetim) (Değişiklik) Yasası", "role": "değişiklik", "passed": "5 Temmuz 1983"},
    {"no": "27/2011", "name": "Kira (Denetim) (Değişiklik) Yasası", "role": "değişiklik", "passed": "2 Mayıs 2011",
     "note": "Bu değişiklik, yürürlüğe girmeden önce dosyalanmış davalara uygulanmaz (Geçici Madde 1)."},
]
hashes = {k: hashlib.sha256(read(k).encode()).hexdigest() for k in ["17-1981", "22-1981", "35-1982", "48-1983", "27-2011"]}

dataset = {
    "name": "KKTC Kira (Denetim) Yasası — madde veri seti",
    "source": SOURCE,
    "fetched": FETCHED,
    "warning": "Metinler Meclis arşivindeki taranmış belgelerden birebir alınmıştır; OCR kaynaklı yazım hataları içerir. Birleştirilmiş (güncel) metin henüz avukat onayından geçmemiştir. 2011 sonrası değişiklik Meclis aramasında bulunamadı; teyit gerekir.",
    "source_sha256": hashes,
    "laws": laws,
    "articles": articles,
}
out = os.path.join(os.path.dirname(__file__), "kira_denetim.json")
json.dump(dataset, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("madde:", len(articles), "değişiklik kaydı:", sum(len(a["amendments"]) for a in articles))
for a in articles:
    print(f'{a["no"]:>9} | {a["title"][:45]:45} | {len(a["text"]):5} kr | {len(a["amendments"])} değ. | {a["status"]}')
