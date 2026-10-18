param([switch]$Seed)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Create .venv and install backend dependencies first. See README.md.' }
if (-not (Test-Path -LiteralPath (Join-Path $root 'frontend\node_modules'))) { throw 'Run npm ci in frontend first.' }
if (-not (Test-Path -LiteralPath (Join-Path $root '.env'))) {
    Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination (Join-Path $root '.env')
}
$statePath = Join-Path $root 'tmp\local-processes.json'
if (Test-Path -LiteralPath $statePath) { throw 'A local session is recorded. Run scripts/stop-local.ps1 before restarting.' }
Push-Location $root
try {
    docker compose up -d db mailpit --wait
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop, then retry.' }
    Push-Location (Join-Path $root 'backend')
    try {
        & $python -m alembic upgrade head
        if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
        if ($Seed) {
            & $python -m app.cli seed
            if ($LASTEXITCODE -ne 0) { throw 'Seeding failed. Set a strong DEMO_PASSWORD in your shell or ignored .env.' }
        }
    } finally { Pop-Location }
    New-Item -ItemType Directory -Force (Join-Path $root 'tmp') | Out-Null
    $records = @()
    $definitions = @(
        @{ Name='api'; Executable=$python; Args=@('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000','--no-access-log'); Directory=(Join-Path $root 'backend') },
        @{ Name='worker'; Executable=$python; Args=@('-m','app.workers.notifications'); Directory=(Join-Path $root 'backend') },
        @{ Name='frontend'; Executable=(Get-Command node).Source; Args=@('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'); Directory=(Join-Path $root 'frontend') }
    )
    foreach ($definition in $definitions) {
        $process = Start-Process -FilePath $definition.Executable -ArgumentList $definition.Args -WorkingDirectory $definition.Directory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root "tmp\local-$($definition.Name).log") -RedirectStandardError (Join-Path $root "tmp\local-$($definition.Name).error.log") -PassThru
        $records += @{ Id=$process.Id; StartTime=$process.StartTime.ToUniversalTime().Ticks; Name=$definition.Name }
    }
    $records | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    foreach ($address in @('http://127.0.0.1:8000/ready', 'http://127.0.0.1:5173/')) {
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            try {
                $response = Invoke-WebRequest -Uri $address -UseBasicParsing -TimeoutSec 2
                if ($response.StatusCode -eq 200) { $ready = $true; break }
            } catch { Start-Sleep -Milliseconds 300 }
        }
        if (-not $ready) { throw "Service not ready at $address. Inspect tmp/local-*.log, then run scripts/stop-local.ps1." }
    }
    Write-Output 'FindBack: http://127.0.0.1:5173 | API: http://127.0.0.1:8000/api/docs | Mailpit: http://127.0.0.1:8025'
    Write-Output 'Logs: tmp/local-*.log. Stop application processes with scripts/stop-local.ps1.'
} finally { Pop-Location }
