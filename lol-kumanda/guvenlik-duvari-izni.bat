@echo off
setlocal
rem Telefon baglanamiyorsa: Windows Guvenlik Duvari'nda LoL Kumanda portuna (4747) izin verir.
rem config.json icinde "port" degerini degistirdiyseniz asagidaki PORT satirini da degistirin.
set PORT=4747

net session >nul 2>&1
if errorlevel 1 (
  echo Yonetici izni isteniyor...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo.
echo Windows daha once Node.js icin ENGELLEME kurali olusturmus olabilir
echo (guvenlik duvari sorusunda "Iptal" dendiyse). Bu kurallar izni gecersiz kilar.
choice /c EH /m "Node.js icin olan engelleme kurallari kaldirilsin mi? (E=Evet, H=Hayir)"
if errorlevel 2 goto addrule
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetFirewallRule -Direction Inbound -Action Block -ErrorAction SilentlyContinue | Where-Object { ($_ | Get-NetFirewallApplicationFilter).Program -like '*\node.exe' } | ForEach-Object { Write-Host ('Kaldiriliyor: ' + $_.DisplayName); $_ | Remove-NetFirewallRule }"

:addrule
netsh advfirewall firewall delete rule name="LoL Kumanda" >nul 2>&1
netsh advfirewall firewall add rule name="LoL Kumanda" dir=in action=allow protocol=TCP localport=%PORT% profile=any
if errorlevel 1 (
  echo [!] Kural eklenemedi.
) else (
  echo.
  echo Tamam: %PORT% portuna gelen baglantilara izin verildi.
)
pause
