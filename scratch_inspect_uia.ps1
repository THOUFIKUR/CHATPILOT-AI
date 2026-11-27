Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# Windows API to switch thread desktop to Default if needed
$cSource = @"
using System;
using System.Runtime.InteropServices;

public class WinStationHelper {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetThreadDesktop(int dwThreadId);

    [DllImport("kernel32.dll")]
    public static extern int GetCurrentThreadId();

    public static bool SwitchToDefaultDesktop() {
        IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return false;
        return SetThreadDesktop(hDesk);
    }
}
"@
Add-Type -TypeDefinition $cSource

$switched = [WinStationHelper]::SwitchToDefaultDesktop()
Write-Host "Switched to Default Desktop: $switched"

# Find WhatsApp process and main window
$proc = Get-Process -Name "WhatsApp.Root" -ErrorAction SilentlyContinue
if (-not $proc) {
    Write-Host "WhatsApp.Root process not found"
    exit 1
}

$hwnd = $proc.MainWindowHandle
Write-Host "WhatsApp HWND: $hwnd"

$el = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
if (-not $el) {
    Write-Host "Could not get AutomationElement from HWND"
    exit 1
}

Write-Host "AutomationElement Name: $($el.Current.Name)"
Write-Host "ClassName: $($el.Current.ClassName)"
Write-Host "ControlType: $($el.Current.ControlType.ProgrammaticName)"

# Find all Edit controls
$editCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
$edits = $el.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCond)
Write-Host "Total Edit elements found: $($edits.Count)"
foreach ($e in $edits) {
    Write-Host "  Edit Name: '$($e.Current.Name)' | AutomationId: '$($e.Current.AutomationId)'"
}

# Find all Button controls
$btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
$btns = $el.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
Write-Host "Total Button elements found: $($btns.Count)"
foreach ($b in $btns) {
    if ($b.Current.Name -match "Send|send|Mic|Audio|Attach") {
        Write-Host "  Button Name: '$($b.Current.Name)' | AutomationId: '$($b.Current.AutomationId)'"
    }
}
