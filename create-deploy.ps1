# create-deploy.ps1 — Ella MDM Deploy-Paket erstellen
# Aufruf: .\create-deploy.ps1
# Ergebnis: ella_mdm_deploy_YYYYMMDD_HHmm.zip im Projektverzeichnis

Set-Location $PSScriptRoot
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Ella MDM - Deploy-Paket erstellen ===" -ForegroundColor Cyan

# 1. Produktions-Build
Write-Host ""
Write-Host "[1/4] Produktions-Build laeuft..." -ForegroundColor Yellow
bun run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build fehlgeschlagen. Abbruch." -ForegroundColor Red
    exit 1
}

# 2. Zieldatei
$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$zipName   = "ella_mdm_deploy_$timestamp.zip"
$zipPath   = Join-Path $PSScriptRoot $zipName

Write-Host ""
Write-Host "[2/4] Staging-Verzeichnis aufbauen..." -ForegroundColor Yellow

$tempDir = Join-Path $env:TEMP "ella_mdm_stage_$timestamp"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Alles kopieren ausser: .git, DB, Secrets, Laufzeit-Daten, alte ZIPs
$excludeNames = @(
    ".git", ".next",
    "ella_mdm.db", ".env.local", "data",
    "memory"
)

Get-ChildItem -Path $PSScriptRoot |
    Where-Object { $_.Name -notin $excludeNames -and $_.Name -notmatch "^ella_mdm_deploy_" } |
    ForEach-Object {
        Copy-Item -Path $_.FullName -Destination (Join-Path $tempDir $_.Name) -Recurse
    }

# .next separat kopieren ohne Cache (zu gross und nicht noetig)
Write-Host "       Kopiere .next (ohne Cache)..." -ForegroundColor Gray
$nextSrc = Join-Path $PSScriptRoot ".next"
$nextDst = Join-Path $tempDir ".next"
Copy-Item -Path $nextSrc -Destination $nextDst -Recurse
$cacheDir = Join-Path $nextDst "cache"
if (Test-Path $cacheDir) { Remove-Item $cacheDir -Recurse -Force }

# 3. ZIP erstellen
Write-Host ""
Write-Host "[3/4] ZIP packen..." -ForegroundColor Yellow
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
Remove-Item $tempDir -Recurse -Force

# 4. Ergebnis
$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "[4/4] Fertig!" -ForegroundColor Green
Write-Host ""
Write-Host "  Paket : $zipName" -ForegroundColor White
Write-Host "  Groesse: $sizeMB MB" -ForegroundColor White
Write-Host ""
Write-Host "Naechste Schritte:" -ForegroundColor Cyan
Write-Host "  1. $zipName per TeamViewer auf den Zielrechner uebertragen"
Write-Host "  2. Dort ausfuehren:"
Write-Host "     powershell -ExecutionPolicy Bypass -File install-deploy.ps1 -ZipFile C:\temp\$zipName"
Write-Host ""
