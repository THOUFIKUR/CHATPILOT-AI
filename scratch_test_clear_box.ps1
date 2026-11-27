Add-Type -AssemblyName System.Windows.Forms

$wshell = New-Object -ComObject WScript.Shell
$null = $wshell.AppActivate("WhatsApp")
Start-Sleep -Milliseconds 600

# Select all existing text in input box and clear it
$wshell.SendKeys("^a")
Start-Sleep -Milliseconds 100
$wshell.SendKeys("{DELETE}")
Start-Sleep -Milliseconds 100

Write-Host "Cleared WhatsApp input box successfully!"
