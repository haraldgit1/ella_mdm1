@echo off
cd /d "%~dp0"

echo ============================================
echo  Ella Edge Integration Hub - Installation
echo ============================================
echo.

REM ---- Schritt 1: node.exe bereitstellen ----
if not exist "%~dp0node.exe" (
    echo Extrahiere node.exe...
    powershell -Command "Expand-Archive -LiteralPath 'deploy-assets\node-win.zip' -DestinationPath '%~dp0.node-tmp' -Force; Move-Item '%~dp0.node-tmp\node-v24.15.0-win-x64\node.exe' '%~dp0node.exe' -Force; Remove-Item '%~dp0.node-tmp' -Recurse -Force"
    if not exist "%~dp0node.exe" (
        echo FEHLER: node.exe konnte nicht extrahiert werden.
        pause
        exit /b 1
    )
    echo node.exe bereit.
) else (
    echo node.exe bereits vorhanden.
)

REM ---- Schritt 2: bun.exe bereitstellen (nur fuer Package-Installation) ----
if not exist "%~dp0bun.exe" (
    echo Extrahiere bun.exe...
    powershell -Command "Expand-Archive -LiteralPath 'deploy-assets\bun-windows-x64.zip' -DestinationPath '%~dp0.bun-tmp' -Force; Move-Item '%~dp0.bun-tmp\bun-windows-x64\bun.exe' '%~dp0bun.exe' -Force; Remove-Item '%~dp0.bun-tmp' -Recurse -Force"
    if not exist "%~dp0bun.exe" (
        echo FEHLER: bun.exe konnte nicht extrahiert werden.
        pause
        exit /b 1
    )
    echo bun.exe bereit.
) else (
    echo bun.exe bereits vorhanden.
)

echo.

REM ---- Schritt 3: Abhaengigkeiten installieren ----
echo Installiere Abhaengigkeiten...
"%~dp0bun.exe" install --ignore-scripts

if errorlevel 1 (
    echo FEHLER bei bun install!
    pause
    exit /b 1
)

REM ---- Schritt 4: better-sqlite3 Windows-Binary einrichten ----
echo.
echo Richte better-sqlite3 Binary ein...

REM In node_modules (fuer Laufzeit)
if not exist "node_modules\better-sqlite3\build\Release" mkdir "node_modules\better-sqlite3\build\Release"
tar -xzf deploy-assets\better-sqlite3-win-x64.tar.gz -C node_modules\better-sqlite3
if errorlevel 1 (
    echo FEHLER: Konnte better-sqlite3 Binary nicht einrichten.
    pause
    exit /b 1
)

REM In .next\node_modules (Turbopack kopiert Mac-Binary beim Build dorthin)
for /d %%D in (.next\node_modules\better-sqlite3-*) do (
    if not exist "%%D\build\Release" mkdir "%%D\build\Release"
    tar -xzf deploy-assets\better-sqlite3-win-x64.tar.gz -C "%%D"
)

REM ---- start.bat erstellen ----
echo @echo off > "%~dp0start.bat"
echo cd /d "%%~dp0" >> "%~dp0start.bat"
echo "%~dp0node.exe" node_modules\next\dist\bin\next start >> "%~dp0start.bat"

echo.
echo ============================================
echo  Installation erfolgreich!
echo ============================================
echo.
echo Anwendung starten:
echo   Doppelklick auf start.bat
echo   oder: node.exe node_modules\next\dist\bin\next start
echo.
echo Browser: http://localhost:3000
echo.
pause
