param(
    [string]$backendUrl = "http://127.0.0.1:8000"
)

# =====================================================================
# ChatPilot AI — Windows Live Notification Watcher for All Contacts
# =====================================================================

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " CHATPILOT AI -- WINDOWS LIVE AUTO-REPLY WATCHER (ALL CONTACTS)" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan

# 1. Check Backend Connectivity
$backendUrl = $backendUrl.TrimEnd('/')
try {
    $health = Invoke-RestMethod -Uri "$backendUrl/api/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
    $appInfo = "ChatPilot Backend is online: " + $health.app + " v" + $health.version
    Write-Host "[OK] $appInfo" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] ChatPilot Backend is not reachable at $backendUrl" -ForegroundColor Red
    Write-Host "Please start the backend: cd 'D:\CHATPILOT AI\backend'; python -m uvicorn main:app --host 127.0.0.1 --port 8000" -ForegroundColor Yellow
    Exit 1
}

# 3. Initialize WinRT Notification Listener
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Windows.Forms
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
}

[Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.NotificationKinds, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.KnownNotificationBindings, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null

$listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
$access = $listener.GetAccessStatus()
Write-Host "[OK] Windows Notification Listener Status: $access" -ForegroundColor Green

if ($access -ne "Allowed") {
    Write-Host "[ERROR] Notification access is not Allowed by Windows settings." -ForegroundColor Red
    Exit 1
}

$arabicTargetName = [char]0x0645 + [char]0x0648 + [char]0x0645 + [char]0x064A + [char]0x0627 + [char]0x0621

Write-Host ""
Write-Host "Monitoring Windows notifications for WhatsApp..." -ForegroundColor Yellow
Write-Host ("Target Contact: Parveen / " + $arabicTargetName + " (+919790171303)") -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop watcher anytime." -ForegroundColor Gray
Write-Host "---------------------------------------------------------------------"

$seenNotificationIds = [System.Collections.Generic.HashSet[uint32]]::new()

# Pre-populate with currently existing notifications so we only trigger on NEW incoming messages
try {
    $asyncOp = $listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)
    $asTask = $asTaskGeneric[0].MakeGenericMethod([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
    $task = $asTask.Invoke($null, @($asyncOp))
    $task.Wait()
    foreach ($n in $task.Result) {
        $null = $seenNotificationIds.Add($n.Id)
    }
} catch {}

while ($true) {
    try {
        $asyncOp = $listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)
        $asTask = $asTaskGeneric[0].MakeGenericMethod([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
        $task = $asTask.Invoke($null, @($asyncOp))
        $task.Wait()
        $notifications = $task.Result

        foreach ($n in $notifications) {
            if ($seenNotificationIds.Contains($n.Id)) {
                continue
            }
            $null = $seenNotificationIds.Add($n.Id)

            $app = $n.AppInfo.DisplayInfo.DisplayName
            $aumid = $n.AppInfo.AppUserModelId

            # Filter for WhatsApp Desktop
            $isWhatsApp = ($app -like "*WhatsApp*") -or ($aumid -like "*WhatsApp*")
            if (-not $isWhatsApp) {
                continue
            }

            $binding = $n.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
            if (-not $binding) {
                continue
            }

            $rawTexts = $binding.GetTextElements()
            $textList = @($rawTexts)
            if ($textList.Count -eq 0) {
                continue
            }

            Write-Host ""
            Write-Host "[NEW WHATSAPP NOTIFICATION DETECTED]" -ForegroundColor Magenta
            Write-Host "  Notification ID : $($n.Id)"

            $textStrings = @()
            foreach ($t in $textList) {
                if ($t.Text -and $t.Text.Trim().Length -gt 0) {
                    $val = $t.Text.Trim()
                    $textStrings += $val
                    Write-Host "  Raw Text        : '$val'" -ForegroundColor Gray
                }
            }

            $detectedSender = ""
            $detectedMessage = ""

            # Case A: Multi-element toast (Line 0 = Contact, Line 1..N = Message Lines)
            if ($textStrings.Count -ge 2) {
                $detectedSender = $textStrings[0]
                $msgParts = @()
                for ($m = 1; $m -lt $textStrings.Count; $m++) {
                    if ($textStrings[$m] -notmatch "unread message") {
                        $msgParts += $textStrings[$m]
                    }
                }
                $detectedMessage = ($msgParts -join " ").Trim()
            }
            # Case B: Single-element toast where sender + message are concatenated
            elseif ($textStrings.Count -ge 1) {
                $rawCombined = $textStrings[0]
                $detectedSender = $rawCombined
                if ($rawCombined -like "*$arabicTargetName*" -or $rawCombined -like "*Parveen*") {
                    $detectedSender = "Parveen / " + $arabicTargetName
                    $cleaned = $rawCombined -replace $arabicTargetName, "" -replace "Parveen", ""
                    # Strip emojis
                    $cleaned = [System.Text.RegularExpressions.Regex]::Replace($cleaned, "[\uD800-\uDFFF\u2600-\u27BF]", "")
                    $detectedMessage = $cleaned.Trim()
                }
            }

            Write-Host "  Detected Sender : $detectedSender"
            Write-Host "  Detected Message: $detectedMessage"

            if ([string]::IsNullOrWhiteSpace($detectedMessage)) {
                Write-Host "  [SKIPPED] Message content is empty." -ForegroundColor DarkGray
                continue
            }

            # Send to Universal WhatsApp Webhook API
            $payloadObj = @{
                notification_id = "winrt_$($n.Id)"
                source = "windows_notification_listener"
                platform = "windows"
                sender = $detectedSender
                title = $detectedSender
                message = $detectedMessage
                is_group = $false
            }
            $jsonPayload = $payloadObj | ConvertTo-Json -Compress

            Write-Host "  Contacting ChatPilot Policy Engine..." -ForegroundColor Cyan

            try {
                $webResp = Invoke-WebRequest -Uri "$backendUrl/api/webhooks/whatsapp" `
                    -Method Post `
                    -ContentType "application/json; charset=utf-8" `
                    -Body ([System.Text.Encoding]::UTF8.GetBytes($jsonPayload)) `
                    -UseBasicParsing
                $utf8Json = [System.Text.Encoding]::UTF8.GetString($webResp.RawContentStream.ToArray())
                $response = $utf8Json | ConvertFrom-Json
            } catch {
                Write-Host "  [ERROR] Webhook call failed: $_" -ForegroundColor Red
                continue
            }

            Write-Host "  ChatPilot Processing Result: $($response.status) (Reason: $($response.reason))" -ForegroundColor Cyan

            if ($response.should_reply -and $response.reply_text) {
                Write-Host ""
                Write-Host "=====================================================================" -ForegroundColor Green
                Write-Host " [SUCCESS] PERSONALIZED AUTO-REPLY GENERATED FOR $($response.sender)!" -ForegroundColor Green
                Write-Host " Incoming Message: '$detectedMessage'" -ForegroundColor Cyan
                Write-Host " Generated Reply : '$($response.reply_text)'" -ForegroundColor White
                Write-Host " Delay Applied   : $($response.reply_delay_seconds)s" -ForegroundColor Gray
                
                # Copy exact clean reply text to clipboard
                Set-Clipboard -Value $response.reply_text
                [System.Media.SystemSounds]::Asterisk.Play()

                # Navigate to WhatsApp chat: by phone or by contact search
                $phone = $response.phone_number
                $contactName = $response.contact_name
                if (-not $contactName) { $contactName = $response.sender }

                $wshell = New-Object -ComObject WScript.Shell

                # Ensure WhatsApp Desktop window is restored and foregrounded even if minimized
                try {
                    if (-not ("Win32Focus" -as [type])) {
                        Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Focus {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
                    }
                    $waProc = Get-Process | Where-Object { $_.MainWindowTitle -like "*WhatsApp*" -and $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
                    if ($waProc) {
                        [Win32Focus]::ShowWindow($waProc.MainWindowHandle, 9) | Out-Null
                        [Win32Focus]::SetForegroundWindow($waProc.MainWindowHandle) | Out-Null
                        Start-Sleep -Milliseconds 300
                    }
                } catch {}

                if ($phone) {
                    $phoneClean = $phone -replace "[^0-9]", ""
                    $uri = "whatsapp://send?phone=$phoneClean"
                    Write-Host "  [FOCUSING] Opening WhatsApp chat for $phoneClean..." -ForegroundColor Yellow
                    Start-Process $uri
                    Start-Sleep -Milliseconds 1200
                } else {
                    # Strip emojis and any non-ASCII characters so WhatsApp search matches cleanly
                    $cleanSearch = [System.Text.RegularExpressions.Regex]::Replace($contactName, "[^\x20-\x7E]", "").Trim()
                    $cleanSearch = [System.Text.RegularExpressions.Regex]::Replace($cleanSearch, "\s+", " ").Trim()
                    if ([string]::IsNullOrWhiteSpace($cleanSearch)) { $cleanSearch = $detectedSender }
                    Write-Host "  [SEARCHING] Navigating to WhatsApp chat for '$cleanSearch'..." -ForegroundColor Yellow

                    $null = $wshell.AppActivate("WhatsApp")
                    Start-Sleep -Milliseconds 500
                    $wshell.SendKeys("^f")
                    Start-Sleep -Milliseconds 350

                    Set-Clipboard -Value $cleanSearch
                    $wshell.SendKeys("^a")
                    Start-Sleep -Milliseconds 100
                    $wshell.SendKeys("^v")
                    Start-Sleep -Milliseconds 800
                    $wshell.SendKeys("{DOWN}")
                    Start-Sleep -Milliseconds 250
                    $wshell.SendKeys("~")
                    Start-Sleep -Milliseconds 800

                    # Restore reply text to clipboard
                    Set-Clipboard -Value $response.reply_text
                }

                try {
                    $null = $wshell.AppActivate("WhatsApp")
                    Start-Sleep -Milliseconds 400

                    # 1. Select all and DELETE any existing text in the box (clears old/leftover text)
                    $wshell.SendKeys("^a")
                    Start-Sleep -Milliseconds 100
                    $wshell.SendKeys("{DELETE}")
                    Start-Sleep -Milliseconds 150

                    # 2. Paste ONLY the exact clean reply text
                    $wshell.SendKeys("^v")
                    Start-Sleep -Milliseconds 250

                    # 3. Submit
                    $wshell.SendKeys("~")
                    Write-Host "  [SENT] Single clean reply dispatched and submitted into WhatsApp!" -ForegroundColor Green
                } catch {
                    Write-Host "  [NOTICE] SendKeys note: $_" -ForegroundColor DarkGray
                }
                Write-Host "=====================================================================" -ForegroundColor Green
            } elseif ($response.reason -eq "AUTO-REPLY PAUSED") {
                Write-Host "  [AUTO-REPLY PAUSED] Staged draft in Reply Inbox for review. Enable Global Auto-Reply when ready." -ForegroundColor Yellow
            } elseif ($response.reason -eq "manual_approval_required") {
                Write-Host "  [HELD] Contact requires manual approval. Staged draft in Reply Inbox." -ForegroundColor Yellow
            } else {
                Write-Host "  [POLICY STATUS] Reason: $($response.reason)" -ForegroundColor DarkGray
            }
        }
    } catch {
        Write-Host "  [NOTICE] Exception during poll: $_" -ForegroundColor DarkGray
    }

    Start-Sleep -Milliseconds 300
}
