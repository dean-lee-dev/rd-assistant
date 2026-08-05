# 练习 2 自检：login -> GET /api/health/stats/summary
# 用法（仓库根目录）：powershell -File scripts/test-health-stats.ps1

$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000/api'

Write-Host "==> POST $base/auth/login"
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"username":"admin","password":"admin123"}'

if (-not $login.accessToken) {
  Write-Host 'FAIL: login response missing accessToken' -ForegroundColor Red
  $login | ConvertTo-Json
  exit 1
}

$token = [string]$login.accessToken
Write-Host ("OK: accessToken length={0}" -f $token.Length)

Write-Host ''
Write-Host '==> A) correct Authorization Bearer + token'
try {
  $ok = Invoke-RestMethod -Uri "$base/health/stats/summary" `
    -Headers @{ Authorization = "Bearer $token" }
  Write-Host 'OK 200' -ForegroundColor Green
  $ok | ConvertTo-Json -Compress
} catch {
  Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ''
Write-Host '==> B) wrong: token only, no Bearer prefix (expect 401)'
try {
  Invoke-RestMethod -Uri "$base/health/stats/summary" `
    -Headers @{ Authorization = $token } | Out-Null
  Write-Host 'unexpected success' -ForegroundColor Yellow
} catch {
  Write-Host 'failed as expected (missing Bearer)' -ForegroundColor DarkYellow
}

Write-Host ''
Write-Host '==> C) wrong: double Bearer prefix (expect 401)'
try {
  Invoke-RestMethod -Uri "$base/health/stats/summary" `
    -Headers @{ Authorization = "Bearer Bearer $token" } | Out-Null
  Write-Host 'unexpected success' -ForegroundColor Yellow
} catch {
  Write-Host 'failed as expected (double Bearer)' -ForegroundColor DarkYellow
}

Write-Host ''
Write-Host 'If A is OK but Apifox still 401, Apifox auth config is wrong.'
