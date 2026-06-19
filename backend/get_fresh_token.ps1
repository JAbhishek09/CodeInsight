# get_fresh_token.ps1
#
# Same login as before, but prints the FULL token string instead of letting
# PowerShell's default table formatter truncate it (which is why the
# previous Invoke-RestMethod output showed "co..." cut off — that's just
# console display truncation, not an actual error. The login worked fine;
# success=True and a real user object came back).
#
# USAGE: powershell -ExecutionPolicy Bypass -File get_fresh_token.ps1

$body = @{
    email    = "abhishekjain.0260@gmail.com"
    password = "1234509876"
} | ConvertTo-Json

$response = Invoke-RestMethod `
    -Uri "http://localhost:5000/api/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

Write-Host "`n=== Login successful for: $($response.data.email) ===" -ForegroundColor Green
Write-Host "User ID: $($response.data._id)"
Write-Host "`n=== FULL TOKEN (copy everything below, exactly as printed) ===" -ForegroundColor Yellow
Write-Output $response.data.token
Write-Host "=== END TOKEN ===" -ForegroundColor Yellow

Write-Host "`nPaste the token above into the extension popup's JWT field, then click Save & Connect." -ForegroundColor Cyan
