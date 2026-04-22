@echo off
cd /d "%~dp0"

echo ============================================
echo  Ella Edge Integration Hub - Installation
echo ============================================
echo.

REM Node.js Headers extrahieren (fuer bessere-sqlite3 Kompilierung)
if not exist "node-headers\node-v18.18.0\include\node" (
    echo Entpacke Node.js Headers...
    if not exist "node-headers" mkdir node-headers
    tar -xzf deploy-assets\node-v18.18.0-headers.tar.gz -C node-headers
    if errorlevel 1 (
        echo FEHLER: Konnte Headers nicht entpacken.
        pause
        exit /b 1
    )
    echo Headers bereit.
) else (
    echo Node.js Headers bereits vorhanden.
)

echo.
echo Installiere Abhaengigkeiten ^(node-gyp kompiliert better-sqlite3^)...
echo Dies kann 2-3 Minuten dauern...
echo.

set npm_config_nodedir=%~dp0node-headers\node-v18.18.0
bun install

if errorlevel 1 (
    echo.
    echo FEHLER bei der Installation!
    echo.
    echo Moegliche Ursache: Visual Studio Build Tools fehlen.
    echo Bitte installieren mit:
    echo   winget install Microsoft.VisualStudio.2022.BuildTools
    echo.
    echo Dann dieses Script erneut ausfuehren.
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
