# Deployment-Anleitung — Ella Edge Integration Hub

## Voraussetzungen (Windows-Zielrechner)

### 1. Bun installieren
PowerShell als Administrator öffnen und ausführen:
```powershell
irm bun.sh/install.ps1 | iex
```
Danach PowerShell neu starten und prüfen:
```powershell
bun --version
```

### 2. Build-Tools für native Module (better-sqlite3)
Bun benötigt zum Kompilieren von `better-sqlite3` die Visual C++ Build Tools:
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```
Oder alternativ: "Desktop development with C++" in Visual Studio installieren.

---

## Installation

### Schritt 1: ZIP entpacken
ZIP-Datei in ein Verzeichnis entpacken, z. B.:
```
C:\Apps\ella_edge_hub\
```

### Schritt 2: Umgebungsvariablen konfigurieren
Im Verzeichnis eine Datei `.env.local` anlegen:
```env
BETTER_AUTH_SECRET=<zufälliger-langer-string-min-32-zeichen>
BETTER_AUTH_URL=http://localhost:3000

# Optional: E-Mail-Versand (Gmail)
EMAIL_FROM=name@gmail.com
EMAIL_USER=name@gmail.com
EMAIL_PASS=<gmail-app-passwort>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```
Für `BETTER_AUTH_SECRET` einen zufälligen String generieren, z. B.:
```powershell
[System.Web.Security.Membership]::GeneratePassword(48, 8)
```

### Schritt 3: Abhängigkeiten installieren
```powershell
cd C:\Apps\ella_edge_hub
bun install
```
> Dieser Schritt kompiliert `better-sqlite3` nativ für Windows — dauert 1–2 Minuten.

### Schritt 4: Produktions-Build erstellen
```powershell
bun run build
```

### Schritt 5: Anwendung starten
```powershell
bun start
```
Die Anwendung läuft auf: **http://localhost:3000**

---

## Erster Start

1. Browser öffnen: http://localhost:3000
2. Auf **Sign Up** klicken und ersten Benutzer anlegen
3. Login mit den neuen Zugangsdaten
4. Unter **Administration → Import CSV** können Stammdaten importiert werden

---

## Autostart mit Windows Task Scheduler (optional)

Damit die Anwendung beim Windows-Start automatisch läuft:

1. Task Scheduler öffnen
2. "Einfache Aufgabe erstellen"
3. Trigger: "Beim Starten des Computers"
4. Aktion: Programm starten
   - Programm: `C:\Users\<user>\.bun\bin\bun.exe`
   - Argumente: `start`
   - Startordner: `C:\Apps\ella_edge_hub`

---

## Daten & Backup

- Die SQLite-Datenbank liegt als einzelne Datei: `ella_mdm.db`
- Backup = Kopie dieser Datei (Anwendung dafür kurz stoppen)
- SPS-Interface-Dateien werden im Unterordner `data\` abgelegt

---

## Update-Vorgang

Bei einer neuen Version:
1. Anwendung stoppen
2. Neue ZIP-Datei entpacken (`.env.local` und `ella_mdm.db` **nicht** überschreiben)
3. `bun install` (bei geänderten Dependencies)
4. `bun run build`
5. `bun start`
