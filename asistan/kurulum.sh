#!/bin/bash
# Bulut oturumunda (Claude Code web) çalışma ortamını kurar: betiklerin beklediği /home/claude/... yollarını
# depo içindeki klasörlere bağlar ve Resmî Gazete ham metinlerini açar.
set -e
REPO=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p /home/claude
[ "$REPO" != /home/claude/kktc-mevzuat-botu ] && ln -sfn "$REPO" /home/claude/kktc-mevzuat-botu
ln -sfn "$REPO/asistan" /home/claude/kira_ai
mkdir -p /home/claude/rg
tar xzf "$REPO/asistan/raw/resmi_gazete/rg_ham.tgz" -C /home/claude/rg
# ek Gazete metinleri (bilgisayardaki oturumdan, rg_ek1_OKU.md); güncel ocr_yapildi.json da içinde
for e in "$REPO"/asistan/raw/resmi_gazete/rg_ek*.tgz; do [ -f "$e" ] && tar xzf "$e" -C /home/claude/rg; done
cp -n "$REPO"/asistan/raw/resmi_gazete/*.json /home/claude/rg/ 2>/dev/null || true
# yayın verisi (app/pub) yayin dalında; derleme betikleri app/pub'ı yeniden üretir
mkdir -p "$REPO/asistan/app/pub"
git -C "$REPO" fetch -q origin yayin:refs/remotes/origin/yayin 2>/dev/null || true
if git -C "$REPO" rev-parse --verify origin/yayin >/dev/null 2>&1; then
  git -C "$REPO" show origin/yayin:veri/kira_asistani.html > /dev/null 2>&1 && \
  for f in $(git -C "$REPO" ls-tree --name-only origin/yayin veri/); do git -C "$REPO" show "origin/yayin:$f" > "$REPO/asistan/app/pub/$(basename $f)"; done
fi
# build_app.py örnek dava dosyasını, bazı testler Playwright'ı sabit yolda bekler
mkdir -p /home/claude/test_kiti && ln -sfn "$REPO/asistan/1_test_dava_dosyasi.txt" /home/claude/test_kiti/1_test_dava_dosyasi.txt
if [ ! -e /opt/npm-tools/node_modules/playwright ]; then
  G=$(npm root -g 2>/dev/null); [ -d "$G/playwright" ] && mkdir -p /opt/npm-tools && ln -sfn "$G" /opt/npm-tools/node_modules || true
fi
pip install --break-system-packages -q pdfplumber 2>/dev/null || true
echo "kurulum tamam: /home/claude/kira_ai -> $REPO/asistan"
