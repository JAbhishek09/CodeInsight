Set-Location "$PSScriptRoot\backend"
Write-Host "=== Installing backend dependencies ===" -ForegroundColor Cyan
npm install 2>&1
Write-Host "=== Starting backend (port 5000) ===" -ForegroundColor Green
npm run dev
