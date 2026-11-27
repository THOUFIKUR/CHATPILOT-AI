Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class DesktopUtil {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    public static bool SwitchToDefault() {
        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) {
            return SetThreadDesktop(hDesk);
        }
        return false;
    }
}
"@

$switched = [DesktopUtil]::SwitchToDefault()
Write-Host "Switched to Default desktop: $switched"

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, "WinUIDesktopWin32WindowClass")
$waElem = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)

if ($waElem) {
    Write-Host "Found WhatsApp AutomationElement: $($waElem.Current.Name)"
    $btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
    $buttons = $waElem.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
    Write-Host "Found buttons: $($buttons.Count)"
    foreach ($b in $buttons) {
        $n = $b.Current.Name
        $aid = $b.Current.AutomationId
        if ($n -or $aid) {
            Write-Host "Button: Name='$n' AutomationId='$aid'"
        }
    }
} else {
    Write-Host "WhatsApp element still not found on RootElement"
}
