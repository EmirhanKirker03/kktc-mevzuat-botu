#!/bin/bash
pkill -f statik.py; pkill -f test_mock.js; pkill -f "node server.js"; sleep 1
SC=/tmp/kira_test; mkdir -p $SC
nohup python3 /home/claude/kira_ai/test/statik.py > $SC/statik.log 2>&1 &
cd /home/claude/kktc-mevzuat-botu/uygulama
MOCK_MOD_DOSYA=/home/claude/kira_ai/test/mock_mod.txt nohup node test_mock.js > $SC/mock.log 2>&1 &
rm -f $SC/test.db
GUNLUK_KARAKTER=200000 GELISTIRME=1 ANTHROPIC_API_KEY=test OTURUM_SIRRI=abcdefghijklmnopqrstuvwxyz0123456789 YONETICI_EPOSTA=yonetici@test.local YONETICI_SIFRE=yonetici12345 VERI_KLASORU=/home/claude/kira_ai/app/pub DB_YOLU=$SC/test.db ANTHROPIC_URL=http://localhost:8899/v1/messages PORT=3100 nohup node server.js > $SC/server.log 2>&1 &
sleep 3; curl -s -o /dev/null -w "3100:%{http_code} " localhost:3100/; curl -s -o /dev/null -w "8811:%{http_code} " 127.0.0.1:8811/kira_asistani.html; echo
