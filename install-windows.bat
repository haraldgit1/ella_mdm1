@echo off
cd /d "%~dp0"

echo ============================================
echo  Ella Edge Integration Hub - Installation
echo ============================================
echo.

REM Abhaengigkeiten installieren (ohne Kompilierung nativer Module)
echo Installiere Abhaengigkeiten...
bun install --ignore-scripts

if errorlevel 1 (
    echo.
    echo FEHLER bei der Installation!
    pause
    exit /b 1
)

REM Pre-built better-sqlite3 Windows-Binary einrichten (kein Kompilieren noetig)
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
pause
