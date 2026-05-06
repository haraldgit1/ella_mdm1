# install-deploy.ps1 — Ella MDM auf Zielrechner installieren
# Aufruf: powershell -ExecutionPolicy Bypass -File install-deploy.ps1 -ZipFile C:\temp\ella_mdm_deploy_20260504_1430.zip
# Voraussetzung: App stoppen, bevor dieses Skript ausgefuehrt wird

param(
    [Parameter(Mandatory = $true)]
    [string]$ZipFile,

    [string]$InstallDir = "C:\apps\ella_mdm"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Ella MDM - Installation ===" -ForegroundColor Cyan
Write-Host "  ZIP       : $ZipFile"
Write-Host "  Zielordner: $InstallDir"
Write-Host ""

# Pruefungen
if (-not (Test-Path $ZipFile)) {
    Write-Host "FEHLER: ZIP-Datei nicht gefunden: $ZipFile" -ForegroundColor Red
    exit 1
}
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "WARNUNG: bun nicht gefunden - wird nur fuer 'bun run start' benoetigt." -ForegroundColor Magenta
    Write-Host "  Installieren: powershell -c `"irm bun.sh/install.ps1 | iex`""
}

# 1. Datenbank sichern
Write-Host "[1/6] Datenbank sichern..." -ForegroundColor Yellow
$dbPath = Join-Path $InstallDir "ella_mdm.db"
if (Test-Path $dbPath) {
    $backupName = "ella_mdm_backup_$(Get-Date -Format 'yyyyMMdd_HHmm').db"
    $backupPath = Join-Path $InstallDir $backupName
    Copy-Item $dbPath $backupPath
    Write-Host "       Backup: $backupName" -ForegroundColor Gray
} else {
    Write-Host "       Keine bestehende Datenbank gefunden (Neuinstallation)." -ForegroundColor Gray
}

# 2. .env.local sichern
Write-Host "[2/6] .env.local sichern..." -ForegroundColor Yellow
$envPath    = Join-Path $InstallDir ".env.local"
$envContent = $null
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    Write-Host "       .env.local gesichert." -ForegroundColor Gray
} else {
    Write-Host "       Keine .env.local gefunden - wird nach Installation benoetigt!" -ForegroundColor Magenta
}

# 3. ZIP entpacken
Write-Host "[3/6] ZIP entpacken..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$tempDir   = Join-Path $env:TEMP "ella_mdm_install_$timestamp"
Expand-Archive -Path $ZipFile -DestinationPath $tempDir -Force

# 4. Dateien kopieren (ella_mdm.db, .env.local und data/ werden NICHT ueberschrieben)
Write-Host "[4/6] Dateien kopieren nach $InstallDir..." -ForegroundColor Yellow
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$preserveNames = @("ella_mdm.db", ".env.local", "data")

Get-ChildItem -Path $tempDir | ForEach-Object {
    if ($_.Name -in $preserveNames) {
        Write-Host "       Uebersprungen (behalten): $($_.Name)" -ForegroundColor Gray
        return
    }
    $dest = Join-Path $InstallDir $_.Name
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    Copy-Item -Path $_.FullName -Destination $dest -Recurse
}

# 5. .env.local wiederherstellen / Hinweis wenn fehlend
Write-Host "[5/6] .env.local..." -ForegroundColor Yellow
if ($envContent) {
    Set-Content -Path $envPath -Value $envContent -NoNewline
    Write-Host "       Wiederhergestellt." -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "  WICHTIG: .env.local fehlt noch!" -ForegroundColor Magenta
    Write-Host "  Bitte $envPath anlegen mit:" -ForegroundColor Magenta
    Write-Host "    BETTER_AUTH_SECRET=IhrGeheimerSchluessel"
    Write-Host "    BETTER_AUTH_URL=http://localhost:3000"
    Write-Host "    SMTP_HOST=..."
    Write-Host "    SMTP_PORT=587"
    Write-Host "    SMTP_SECURE=false"
    Write-Host "    SMTP_USER=..."
    Write-Host "    SMTP_PASS=..."
    Write-Host "    MAIL_FROM=..."
    Write-Host ""
}

# data-Verzeichnis anlegen falls fehlt
$dataDir = Join-Path $InstallDir "data"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }

# 6. node_modules ist bereits im Paket enthalten - kein bun install noetig
Write-Host "[6/6] node_modules bereits im Paket enthalten - kein Kompilieren noetig." -ForegroundColor Yellow

# Aufraumen
Remove-Item $tempDir -Recurse -Force

Write-Host ""
Write-Host "=== Installation abgeschlossen ===" -ForegroundColor Green
Write-Host ""
Write-Host "App starten:" -ForegroundColor Cyan
Write-Host "  cd $InstallDir"
Write-Host "  bun run start"
Write-Host ""
Write-Host "Oder Doppelklick auf: $InstallDir\start.bat"
Write-Host ""
