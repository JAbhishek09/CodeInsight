# diagnose_login.ps1
#
# PowerShell-native login helper. The earlier `curl -X POST ... -H ... -d ...`
# command is bash/Linux curl syntax. On Windows PowerShell, `curl` is an
# ALIAS for Invoke-WebRequest, which does not understand -X, -H, or -d flags
# at all — hence the three separate "not recognized" errors, one per flag.
#
# This script uses Invoke-RestMethod (PowerShell's actual HTTP client) with
# its native parameter names instead.
#
# USAGE:
#   1. Edit the $email and $password values below to your real account.
#   2. Run:  powershell -ExecutionPolicy Bypass -File diagnose_login.ps1
#      (or just paste the Invoke-RestMethod block directly into your terminal)

$email    = "abhishekjain.0260@gmail.com"
$password = "1234509876"

$body = @{
    email    = $email
    password = $password
} | ConvertTo-Json

Write-Host "Attempting login as $email ..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod `
        -Uri "http://localhost:5000/api/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body

    if ($response.success) {
        Write-Host "`n✅ Login succeeded.`n" -ForegroundColor Green
        Write-Host "Token (copy everything between the quotes below into the extension popup):`n" -ForegroundColor Yellow
        Write-Host $response.data.token -ForegroundColor White
        Write-Host "`nToken payload preview:" -ForegroundColor Cyan
        Write-Host "  user id: $($response.data._id)"
        Write-Host "  email:   $($response.data.email)"
    } else {
        Write-Host "`n⚠️  Backend responded but success=false:" -ForegroundColor Yellow
        Write-Host ($response | ConvertTo-Json)
    }
}
catch {
    Write-Host "`n❌ Login request failed." -ForegroundColor Red

    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        Write-Host "  HTTP status: $statusCode"

        # PowerShell's error response body needs to be read manually
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "  Response body: $errorBody"

        if ($statusCode -eq 401) {
            Write-Host "`n  This means the email exists but the password is wrong," -ForegroundColor Yellow
            Write-Host "  OR the email itself doesn't exist in the database." -ForegroundColor Yellow
            Write-Host "  Run diagnose_login.mjs (node script) to see which accounts actually exist:"
            Write-Host "    node diagnose_login.mjs"
        }
    } else {
        Write-Host "  $($_.Exception.Message)"
        Write-Host "`n  This usually means the backend isn't running on port 5000 at all." -ForegroundColor Yellow
        Write-Host "  Start it with: npm run dev   (from the backend/ folder)"
    }
}
