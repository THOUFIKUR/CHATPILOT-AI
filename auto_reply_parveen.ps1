# =====================================================================
# ChatPilot AI — Automated Direct Sender for Parveen
# Contact: Parveen / مومياء ❤️‍🔥❤️ (+919790171303)
# =====================================================================

param (
    [string]$ReplyText = "Ok thaa"
)

Add-Type -AssemblyName System.Windows.Forms

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " CHATPILOT AI -- DIRECT WHATSAPP SENDER (PARVEEN AUTO-REPLY)" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "Target: Parveen (+919790171303)" -ForegroundColor Yellow
Write-Host "Sending: '$ReplyText'" -ForegroundColor White

$phone = "919790171303"
$encoded = [System.Uri]::EscapeDataString($ReplyText)
$uri = "whatsapp://send?phone=$phone&text=$encoded"

Write-Host "1. Opening WhatsApp chat window with staged reply..." -ForegroundColor Cyan
Start-Process $uri

Write-Host "2. Waiting 1.5 seconds for WhatsApp to focus..." -ForegroundColor Cyan
Start-Sleep -Milliseconds 1500

Write-Host "3. Automatically submitting Enter key to send message..." -ForegroundColor Green
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

Write-Host "=====================================================================" -ForegroundColor Green
Write-Host " [SUCCESS] Auto-reply directly sent into WhatsApp!" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
