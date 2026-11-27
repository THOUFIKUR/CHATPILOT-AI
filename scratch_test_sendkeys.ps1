try {
    $wshell = New-Object -ComObject WScript.Shell
    $wshell.SendKeys("~")
    Write-Host "WScript.Shell SendKeys SUCCESS without error!"
} catch {
    Write-Host "WScript.Shell SendKeys FAILED: $_"
}
