#!/bin/bash
# macOS: Finder'da çift tıklayarak çalıştırın.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js bulunamadı. https://nodejs.org adresinden LTS sürümünü kurun."
  open "https://nodejs.org/tr/download"
  read -n 1 -s -r -p "Kapatmak için bir tuşa basın"
  exit 1
fi
if [ ! -f node_modules/ws/package.json ] || [ ! -f node_modules/qrcode-terminal/package.json ]; then
  echo "Gerekli paketler kuruluyor (ilk çalıştırmada bir kez)..."
  npm install --omit=dev --no-audit --no-fund || exit 1
fi
node src/main.js "$@"
