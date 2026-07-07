# IAOMS Startup Script - ASCII Edition
# Prevents 502 / Error 1033

$ports = @(3001, 8080)

Write-Host "Killing all existing processes..."

# Kill all cloudflared instances
Get-Process | Where-Object { $_.Name -like "*cloudflared*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Release ports
foreach ($port in $ports) {
    $pids = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique
    foreach ($id in $pids) {
        try {
            Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
            Write-Host "Killed PID $id on port $port"
        } catch {
            Write-Host "Could not kill PID $id"
        }
    }
}
Start-Sleep -Seconds 2

Write-Host "Starting Vite and Backend..."
$devJob = Start-Job -ScriptBlock {
    Set-Location $using:PSScriptRoot
    $env:VITE_TUNNEL = "true"
    npm run dev
}

Write-Host "Waiting for Vite dev server to be ready on 8080..."
$maxWait  = 60
$elapsed  = 0
$ready    = $false
while ($elapsed -lt $maxWait) {
    $conn = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
    $elapsed++
    Write-Host ".. $elapsed s"
}

if (-not $ready) {
    Write-Host "Vite did not start. Aborting."
    Stop-Job $devJob -ErrorAction SilentlyContinue
    Remove-Job $devJob -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "Vite is ready! Starting Cloudflare Tunnel..."
Start-Sleep -Seconds 2

Write-Host "Tunnel starting -> https://app.iaoms.dev"

$devJob | Receive-Job -Wait:$false

& "C:\Program Files (x86)\cloudflared\cloudflared.exe" --config "C:\Users\srich\.cloudflared\config.yml" tunnel run dd2d7909-42f9-40f3-bd3e-3e582ec0740e

Stop-Job  $devJob -ErrorAction SilentlyContinue
Remove-Job $devJob -ErrorAction SilentlyContinue
