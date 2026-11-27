$wshell = New-Object -ComObject WScript.Shell
$success = $wshell.AppActivate("WhatsApp")
Write-Host "AppActivate WhatsApp result: $success"
