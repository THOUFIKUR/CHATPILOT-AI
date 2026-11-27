# =====================================================================
# CHATPILOT AI -- ANDROID USB DEPLOYMENT & PORT FORWARDING SCRIPT
# =====================================================================
param (
    [switch]$BuildOnly = $false,
    [switch]$Dev = $false
)

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " CHATPILOT AI -- ANDROID DEPLOYMENT (REDMI NOTE 13 PRO 5G / USB)" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan

# 1. Check for ADB Device Connection
Write-Host "`n[1/4] Checking ADB USB Connection..." -ForegroundColor Yellow
$devices = adb devices | Out-String
if ($devices -notmatch "\b\w+\s+device\b") {
    Write-Host "[WARNING] No Android device found in 'device' state via ADB." -ForegroundColor Red
    Write-Host "Please ensure:" -ForegroundColor Yellow
    Write-Host "  1. Phone is connected via USB cable." -ForegroundColor White
    Write-Host "  2. 'USB Debugging' is enabled in Developer Options." -ForegroundColor White
    Write-Host "  3. 'Install via USB' and 'USB Debugging (Security settings)' are ON." -ForegroundColor White
    Write-Host "  4. Tap 'Always allow from this computer' on phone prompt." -ForegroundColor White
} else {
    Write-Host "[OK] Android device detected via USB debugging!" -ForegroundColor Green
}

# 2. Reverse Ports (Allows phone browser / app to access localhost:8000 and localhost:5173 over USB cable)
Write-Host "`n[2/4] Setting up ADB Port Reverse (localhost bridging over USB)..." -ForegroundColor Yellow
try {
    adb reverse tcp:8000 tcp:8000
    adb reverse tcp:5173 tcp:5173
    Write-Host "[OK] Reversed TCP port 8000 (FastAPI Backend) and 5173 (Vite UI)." -ForegroundColor Green
    adb reverse --list
} catch {
    Write-Host "[INFO] Port reverse skipped until USB device is authorized." -ForegroundColor Gray
}

# 3. Build Web Assets
Write-Host "`n[3/4] Compiling Frontend Client Distribution..." -ForegroundColor Yellow
Set-Location "d:\CHATPILOT AI\frontend"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Frontend build failed. Please fix compilation issues." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Frontend build succeeded!" -ForegroundColor Green

# 4. Deploy or Run Tauri Android
if ($Dev) {
    Write-Host "`n[4/4] Starting Tauri Android Dev Server..." -ForegroundColor Yellow
    npx tauri android dev
} else {
    Write-Host "`n[4/4] Building and Packaging Android Release APK..." -ForegroundColor Yellow
    npx tauri android build
}

Write-Host "`n=====================================================================" -ForegroundColor Cyan
Write-Host " [SUCCESS] Android deployment script completed!" -ForegroundColor Green
Write-Host " Access ChatPilot on your phone at: http://localhost:5173" -ForegroundColor Cyan
Write-Host " Backend API endpoint on phone:     http://localhost:8000/api" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
