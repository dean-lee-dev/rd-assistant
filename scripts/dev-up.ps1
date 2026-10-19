# Local one-click: PostgreSQL + Redis + API + Worker + Web
# Usage from repo root:
#   powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$ApiDir = Join-Path $Root 'apps\api'
$WebDir = Join-Path $Root 'apps\web'
$PgService = 'postgresql-x64-17'

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-PortOpen([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(800)
    if ($ok -and $client.Connected) {
      $client.EndConnect($iar)
      $client.Close()
      return $true
    }
    $client.Close()
  } catch {}
  return $false
}

function Start-NamedWindow([string]$Title, [string]$WorkingDirectory, [string]$Command) {
  $arg = "-NoExit -ExecutionPolicy Bypass -Command `"Set-Location -LiteralPath '$WorkingDirectory'; `$Host.UI.RawUI.WindowTitle='$Title'; $Command`""
  Start-Process powershell -ArgumentList $arg | Out-Null
}

Write-Host "Repo: $Root" -ForegroundColor DarkGray

Write-Step "PostgreSQL ($PgService)"
$svc = Get-Service -Name $PgService -ErrorAction SilentlyContinue
if (-not $svc) {
  Write-Host "Service $PgService not found. Install PostgreSQL 17 first." -ForegroundColor Red
  exit 1
}
if ($svc.Status -ne 'Running') {
  try {
    Start-Service $PgService
    Start-Sleep -Seconds 1
  } catch {
    Write-Host "Failed to start service (need Admin?). Try: Start-Service $PgService" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
  }
}
$svc = Get-Service -Name $PgService
if ($svc.Status -eq 'Running') {
  Write-Host "PostgreSQL: Running (5432)" -ForegroundColor Green
} else {
  Write-Host "PostgreSQL not Running: $($svc.Status)" -ForegroundColor Red
  exit 1
}

Write-Step "Redis (WSL Ubuntu :6379)"
if (Test-PortOpen 6379) {
  Write-Host "Redis: already listening on 6379" -ForegroundColor Green
} else {
  try {
    wsl -d Ubuntu -- bash -lc 'redis-cli ping >/dev/null 2>&1 || redis-server --daemonize yes --bind 0.0.0.0 --protected-mode no --port 6379; redis-cli ping'
    Start-Sleep -Seconds 1
  } catch {
    Write-Host "WSL Redis failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
  if (Test-PortOpen 6379) {
    Write-Host "Redis: Running (6379)" -ForegroundColor Green
  } else {
    Write-Host "Redis port 6379 still closed." -ForegroundColor Red
    exit 1
  }
}

Write-Step "Open API / Worker / Web windows"
if (-not (Test-Path (Join-Path $ApiDir 'package.json'))) {
  Write-Host "Missing apps/api/package.json" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path (Join-Path $WebDir 'package.json'))) {
  Write-Host "Missing apps/web/package.json" -ForegroundColor Red
  exit 1
}

Start-NamedWindow 'rd-assistant api' $ApiDir 'npm run start:dev'
Start-Sleep -Milliseconds 800
Start-NamedWindow 'rd-assistant worker' $ApiDir 'npm run start:worker'
Start-Sleep -Milliseconds 800
Start-NamedWindow 'rd-assistant web' $WebDir 'npm start'

Write-Host ""
Write-Host "Started:" -ForegroundColor Green
Write-Host "  PostgreSQL  127.0.0.1:5432"
Write-Host "  Redis       127.0.0.1:6379"
Write-Host "  API         http://localhost:3000"
Write-Host "  Worker      weekly-report queue"
Write-Host "  Web         http://localhost:5173"
Write-Host ""
Write-Host "Open http://localhost:5173"
Write-Host "Keep worker running or weekly-report jobs stay queued."
