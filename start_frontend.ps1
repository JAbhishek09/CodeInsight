Set-Location "$PSScriptRoot\frontend"
Write-Host "=== Installing frontend dependencies ===" -ForegroundColor Cyan
npm install 2>&1
Write-Host "=== Starting frontend (port 5173) ===" -ForegroundColor Green
npm run dev
