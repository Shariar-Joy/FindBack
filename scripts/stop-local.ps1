$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $root 'tmp\local-processes.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Output 'No scripted local session is recorded.'; return }
$records = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
foreach ($record in $records) {
    $process = Get-Process -Id $record.Id -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq $record.StartTime) {
        Stop-Process -Id $process.Id
        Write-Output "Stopped FindBack $($record.Name)."
    }
}
Remove-Item -LiteralPath $statePath
Write-Output 'Application stopped. Persistent PostgreSQL and Mailpit containers remain available; use docker compose stop to stop them.'
