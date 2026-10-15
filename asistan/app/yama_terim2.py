"""Arama: halk dilindeki bazı ifadelerin KKTC mevzuatındaki karşılıkları (antika eser → eski eser, kamu görevlisi →
Kamu Görevlileri Yasası, çocuğun korunması → Çocuklar Yasası, kurum kazancı → Kurumlar Vergisi)."""
import sys
p = sys.argv[1] if len(sys.argv) > 1 else 'template.html'
s = open(p, encoding='utf-8').read()
eski = "[/vekaletname/i,'vekaletname avukat tutma varakası']];"
yeni = ("[/vekaletname/i,'vekaletname avukat tutma varakası'],[/antika|tarihi eser|arkeolojik|define/i,'eski eser'],"
        "[/kamu görevlisi|devlet memuru|\\bmemur/i,'Kamu Görevlileri Yasası'],[/çocuğun korunması|çocuk koruma|korunmaya muhtaç/i,'Çocuklar Yasası korunma emri'],"
        "[/kurum kazanc|kurumlar vergi|şirket kazanc/i,'Kurumlar Vergisi']];")
if "'eski eser'" not in s:
    assert s.count(eski) == 1
    s = s.replace(eski, yeni)
open(p, 'w', encoding='utf-8').write(s); print('tamam')
