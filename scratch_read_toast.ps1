Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
}

[Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.NotificationKinds, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.KnownNotificationBindings, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null

$listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
$asyncOp = $listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)
$asTask = $asTaskGeneric[0].MakeGenericMethod([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
$task = $asTask.Invoke($null, @($asyncOp))
$task.Wait()

Write-Host "Total active notifications: $($task.Result.Count)"
foreach ($n in $task.Result) {
    $app = $n.AppInfo.DisplayInfo.DisplayName
    if ($n.Id -eq 45092 -or $app -like "*WhatsApp*") {
        Write-Host "--- ID: $($n.Id) | App: $app ---"
        $binding = $n.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
        if ($binding) {
            foreach ($t in $binding.GetTextElements()) {
                Write-Host "  Text: '$($t.Text)'"
            }
        }
    }
}
