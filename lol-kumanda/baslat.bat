@echo off
setlocal
cd /d "%~dp0"
title LoL Kumanda

where node >nul 2>nul
if errorlevel 1 goto nonode

if exist "node_modules\ws\package.json" if exist "node_modules\qrcode-terminal\package.json" goto run
echo Gerekli paketler kuruluyor - ilk calistirmada bir kez, biraz surebilir...
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 goto noinstall

:run
node src\main.js %*
echo.
echo LoL Kumanda kapandi.
pause
exit /b 0

:nonode
echo.
echo  [!] Node.js bulunamadi.
echo      Acilan sayfadan Node.js "LTS" surumunu indirip kurun,
echo      sonra bu dosyaya tekrar cift tiklayin.
echo.
start "" "https://nodejs.org/tr/download"
pause
exit /b 1

:noinstall
echo.
echo  [!] Paketler kurulamadi. Internet baglantinizi kontrol edip tekrar deneyin.
pause
exit /b 1
