# Register the josh-tick Windows scheduled task.
#
# Runs `josh tick` every 5 minutes, hidden, no UI flash. This is the
# mechanical heartbeat for the ~/.josh/ orchestrator — fast (~50ms),
# free, and independent of OpenClaw's availability.
#
# Pairs with OpenClaw cron `levi-orchestrator-oversight` (registered
# separately via openclaw cron add) which runs every 1h to read status,
# validate, and alert on anomalies.
#
# Run from any PowerShell:  pwsh -NoProfile -File register-task-scheduler.ps1
# Re-run is safe: -Force overwrites any existing task with the same name.
#
# Prerequisites:
#   - Node.js installed at C:\Program Files\nodejs\node.exe (default install)
#   - C:\Levi\bin\josh\josh.js exists (this repo cloned to C:\Levi)
#   - The josh CLI globally installed via `npm link` from C:\Levi\bin\josh
#     (not strictly required since we call node directly, but useful for
#      manual `josh status` invocations)

$ErrorActionPreference = 'Stop'

$action = New-ScheduledTaskAction `
    -Execute 'C:\Program Files\nodejs\node.exe' `
    -Argument 'C:\Levi\bin\josh\josh.js tick'

$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5)

$settings = New-ScheduledTaskSettingsSet `
    -Hidden `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName 'josh-tick' `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description 'josh orchestrator heartbeat - runs josh tick every 5 minutes via the Levi runtime' `
    -Force | Out-Null

# Verify
$task = Get-ScheduledTask -TaskName 'josh-tick'
$info = Get-ScheduledTaskInfo -TaskName 'josh-tick'
[PSCustomObject]@{
    State        = $task.State
    LastRunTime  = $info.LastRunTime
    NextRunTime  = $info.NextRunTime
    Interval     = '5 minutes'
    Hidden       = $task.Settings.Hidden
    ExecLimit    = $task.Settings.ExecutionTimeLimit
} | Format-List

Write-Host "`njosh-tick registered. Next run: $($info.NextRunTime)" -ForegroundColor Green
Write-Host "To remove: Unregister-ScheduledTask -TaskName 'josh-tick' -Confirm:`$false" -ForegroundColor DarkGray
