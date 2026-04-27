@echo off
cd /d "%~dp0"

echo ============================================
echo  Ella Edge Integration Hub - Installation
echo ============================================
echo.

REM ---- Schritt 1: Bun installieren falls nicht vorhanden ----
where bun >nul 2>&1
if errorlevel 1 (
    echo Bun nicht gefunden - wird aus deploy-assets installiert...
    echo.

    set BUN_DIR=%USERPROFILE%\.bun\bin
    if not exist "%USERPROFILE%\.bun\bin" mkdir "%USERPROFILE%\.bun\bin"

    powershell -Command "Expand-Archive -LiteralPath 'deploy-assets\bun-windows-x64.zip' -DestinationPath '.bun-tmp' -Force; Move-Item '.bun-tmp\bun-windows-x64\bun.exe' '%USERPROFILE%\.bun\bin\bun.exe' -Force; Remove-Item '.bun-tmp' -Recurse -Force"

    if not exist "%USERPROFILE%\.bun\bin\bun.exe" (
        echo FEHLER: bun.exe konnte nicht extrahiert werden.
        pause
        exit /b 1
    )

    REM PATH fuer diese Session und dauerhaft setzen
    set PATH=%USERPROFILE%\.bun\bin;%PATH%
    setx PATH "%USERPROFILE%\.bun\bin;%PATH%" >nul 2>&1

    echo Bun installiert: %USERPROFILE%\.bun\bin\bun.exe
) else (
    echo Bun bereits installiert.
)

echo.

REM ---- Schritt 2: Abhaengigkeiten installieren ----
echo Installiere Abhaengigkeiten...
bun install --ignore-scripts

if errorlevel 1 (
    echo.
    echo FEHLER bei bun install!
    pause
    exit /b 1
)

REM ---- Schritt 3: better-sqlite3 Windows-Binary einrichten ----
echo.
echo Richte better-sqlite3 Windows-Binary ein...

if not exist "node_modules\better-sqlite3\build\Release" (
    mkdir "node_modules\better-sqlite3\build\Release"
)

tar -xzf deploy-assets\better-sqlite3-win-x64.tar.gz -C node_modules\better-sqlite3

if errorlevel 1 (
    echo FEHLER: Konnte better-sqlite3 Binary nicht einrichten.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Installation erfolgreich!
echo ============================================
echo.
echo Naechste Schritte:
echo   1. bun run build
echo   2. bun start
echo   3. Browser: http://localhost:3000
echo.
echo HINWEIS: Neues Terminal oeffnen damit PATH aktualisiert ist.
echo.
pause
