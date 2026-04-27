@echo off
cd /d "%~dp0"

echo ============================================
echo  Ella Edge Integration Hub - Installation
echo ============================================
echo.

REM ---- Schritt 1: bun.exe bereitstellen ----
where bun >nul 2>&1
if errorlevel 1 (
    if not exist "%~dp0bun.exe" (
        echo Extrahiere bun.exe...
        powershell -Command "Expand-Archive -LiteralPath 'deploy-assets\bun-windows-x64.zip' -DestinationPath '%~dp0.bun-tmp' -Force"
        move "%~dp0.bun-tmp\bun-windows-x64\bun.exe" "%~dp0bun.exe"
        rmdir /s /q "%~dp0.bun-tmp"
        if not exist "%~dp0bun.exe" (
            echo FEHLER: bun.exe konnte nicht extrahiert werden.
            pause
            exit /b 1
        )
        echo bun.exe bereit.
    ) else (
        echo bun.exe bereits vorhanden.
    )
    set BUN=%~dp0bun.exe
) else (
    set BUN=bun
    echo Bun bereits im PATH installiert.
)

echo.

REM ---- Schritt 2: Abhaengigkeiten installieren ----
echo Installiere Abhaengigkeiten...
"%BUN%" install --ignore-scripts

if errorlevel 1 (
    echo FEHLER bei bun install!
    pause
    exit /b 1
)

REM ---- Schritt 3: better-sqlite3 Windows-Binary einrichten ----
echo.
echo Richte better-sqlite3 Binary ein...

if not exist "node_modules\better-sqlite3\build\Release" (
    mkdir "node_modules\better-sqlite3\build\Release"
)

tar -xzf deploy-assets\better-sqlite3-win-x64.tar.gz -C node_modules\better-sqlite3

if errorlevel 1 (
    echo FEHLER: Konnte better-sqlite3 Binary nicht einrichten.
    pause
    exit /b 1
)

REM ---- start.bat erstellen ----
echo @echo off > "%~dp0start.bat"
echo cd /d "%%~dp0" >> "%~dp0start.bat"
echo "%~dp0bun.exe" start >> "%~dp0start.bat"

echo.
echo ============================================
echo  Installation erfolgreich!
echo ============================================
echo.
echo Anwendung starten:
echo   Doppelklick auf start.bat
echo   oder: "%BUN%" start
echo.
echo Browser: http://localhost:3000
echo.
pause
