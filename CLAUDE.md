# CLAUDE.md — Ella Edge Integration Hub

Diese Datei steuert das Verhalten von Claude Code in diesem Projekt.
Sie enthält alle relevanten Informationen über Architektur, Konventionen und aktuellen Stand.

---

## Projekt-Übersicht

**Ella Edge Integration Hub** ist ein leichtgewichtiges Master Data Management System für lokale Edge-Geräte,
angebunden an die Cloud-Plattform Ella-Energy (AWS).

**Zweck:** Verwaltung von Projekten, Devices, Alarmstufen, E-Mail-Adressen, Lookup-Werten und Monitoring-Definitionen.
**Betrieb:** Lokal auf Edge-Hardware, Sync mit Cloud via REST-API und CSV-Import/Export.

---

## Tech-Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Runtime | Bun |
| Sprache | TypeScript (strict) |
| Styling | TailwindCSS 4 |
| Datenbank | SQLite via `better-sqlite3` |
| Auth | `better-auth` (Email/Password) |
| Git-Remote | https://github.com/haraldgit1/ella_mdm1.git |

---

## Entwicklung

```bash
# Dev-Server starten
bun dev

# Produktions-Build prüfen
bun run build

# TypeScript prüfen
bunx tsc --noEmit

# Testdaten einspielen (nur einmalig nötig)
bunx tsx src/lib/db/seed-testdata.ts

# Test-Login
# E-Mail:   herbert1@test.local
# Passwort: Herbert1!
```

---

## Verzeichnisstruktur

```
ella_mdm/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── page.tsx             # Root → redirect /login
│   │   ├── layout.tsx           # Root Layout
│   │   ├── login/               # Login-Seite
│   │   ├── signup/              # Registrierung
│   │   ├── dashboard/           # Dashboard (2-Ebenen, 5 Sektionen)
│   │   ├── projects/            # Projekte (Suche + Liste + Detail)
│   │   │   └── [projectName]/   # Projekt-Detailseite (Tabs)
│   │   ├── devices/             # Devices (Suche + Liste + Detail)
│   │   │   └── [projectName]/[deviceName]/
│   │   ├── monitors/            # Monitors (Suche + Liste + Detail)
│   │   │   └── [projectName]/   # Monitor-Detailseite (?monitor=name)
│   │   ├── alarms/              # Alarme (Suche + Liste + Dialog)
│   │   ├── reports/             # Reports (Platzhalter)
│   │   ├── import/              # CSV-Import (mit Encoding-Auswahl)
│   │   ├── export/              # CSV-Export
│   │   └── api/                 # API-Routen
│   │       ├── auth/[...all]/   # better-auth Handler
│   │       ├── projects/        # GET, POST
│   │       │   └── [projectName]/ # GET, PUT (inkl. lock/unlock), DELETE
│   │       │       └── send-test-email/ # POST
│   │       ├── devices/         # GET, POST
│   │       │   └── [projectName]/[deviceName]/ # GET, PUT (inkl. lock/unlock), DELETE
│   │       ├── monitors/        # GET, POST
│   │       │   └── [projectName]/[monitorName]/ # GET, PUT (inkl. lock/unlock, rename), DELETE
│   │       ├── monitor-variables/ # GET, POST
│   │       │   └── [projectName]/[monitorName]/[name]/ # PUT, DELETE
│   │       ├── monitor-interface/ # POST (SPS-Interface-Datei für Monitor)
│   │       ├── alarms/          # GET (alle Projekte), POST
│   │       │   └── [projectName]/[alarmLevelCode]/ # PUT, DELETE
│   │       ├── emails/          # GET, POST
│   │       │   └── [projectName]/[emailAddress]/ # DELETE
│   │       ├── lookups/         # GET
│   │       │   └── [functionCode]/[code]/ # PUT, DELETE
│   │       ├── variables/       # GET, POST
│   │       │   └── [projectName]/[deviceName]/[name]/ # PUT, DELETE
│   │       ├── sps-interface/   # POST (SPS-Interface-Datei für Device)
│   │       ├── import/          # POST (CSV, mit charset-Parameter)
│   │       └── export/          # GET (CSV)
│   ├── components/              # Wiederverwendbare UI-Komponenten
│   │   ├── AuditInfo.tsx
│   │   ├── dialogs/
│   │   ├── forms/
│   │   ├── lists/
│   │   ├── tabs/
│   │   └── editor/
│   ├── lib/
│   │   ├── auth/auth.ts         # better-auth Server-Instanz
│   │   ├── auth/auth-client.ts  # better-auth Client-Instanz
│   │   ├── db/db.ts             # SQLite-Singleton (getDb())
│   │   ├── db/schema.sql        # DDL aller Tabellen
│   │   ├── db/seed.ts           # Lookup-Grunddaten
│   │   ├── db/seed-testdata.ts  # Vollständige Testdaten inkl. Benutzer
│   │   ├── audit/audit.ts       # auditInsert / auditUpdate / auditLock / auditDelete
│   │   ├── import/
│   │   │   ├── import-handler.ts # Importlogik für alle Typen
│   │   │   └── csv-parser.ts    # CSV-Parser (auto-detect ; vs ,)
│   │   └── export/
│   └── types/                   # TypeScript-Interfaces
│       ├── project.ts
│       ├── device.ts
│       ├── alarm.ts
│       ├── email.ts
│       └── monitor.ts           # Monitor + MonitorVariable + Input-Typen
├── data/                        # SPS-Interface-Dateien (nicht in Git)
├── ella_mdm.db                  # SQLite-Datenbankdatei (nicht in Git)
├── ella_edge_integration_hub_spec.md  # Fachliche Spezifikation
└── CLAUDE.md                    # Diese Datei
```

---

## Datenbank

### Schema-Initialisierung

Das Schema wird beim ersten `getDb()`-Aufruf automatisch aus `schema.sql` eingespielt.
**Keine manuellen Migrations-Scripts nötig.**

### Tabellen

| Tabelle | Primärschlüssel | Beschreibung |
|---|---|---|
| `mdm_project` | `project_name` | Projekte |
| `mdm_device` | `project_name + device_name` | Devices |
| `mdm_device_variable` | `project_name + device_name + name` | Variablen pro Device |
| `mdm_project_alarm` | `project_name + alarm_level_code` | Alarmstufen pro Projekt |
| `mdm_project_email` | `project_name + email_address` | Ziel-E-Mails pro Projekt |
| `mdm_monitor` | `project_name + monitor_name` | Monitor-Definitionen |
| `mdm_monitor_variable` | `project_name + monitor_name + name` | Variablen pro Monitor |
| `mdm_lookup` | `function_code + code` | Lookup-Werte für Dropdowns |
| `mdm_import_log` | `import_id` | Protokoll CSV-Importe |
| `mdm_sync_log` | `sync_id` | Protokoll Cloud-Sync |
| `user`, `session`, `account`, `verification` | — | better-auth (auto-verwaltet) |

### Lookup-Codes

| function_code | Bedeutung | Beispielwerte |
|---|---|---|
| 100 | DeviceType | Sensor, Motor, Pumpe, Ventil, Regler |
| 200 | ProjectType | Kraftwerk, Anlage, Gebäude, Infrastruktur |
| 300 | DataType | (Variablen-Datentypen) |
| 400 | MonitorType | 1=Meldung, 2=Störung |

### Audit-Felder (in allen MDM-Tabellen)

Jede Tabelle enthält: `create_user`, `create_timestamp`, `modify_user`, `modify_timestamp`, `modify_status`, `version`

`modify_status` ∈ `{ 'inserted', 'updated', 'locked', 'deleted' }`

**Wichtig:** Audit-Felder werden **in der Applikation** gesetzt (nicht per Trigger).
Hilfsfunktionen in `src/lib/audit/audit.ts`:
- `auditInsert(user)` → setzt alle 5 Felder + version=1
- `auditUpdate(user)` → setzt modify_*
- `auditLock(user)` → setzt modify_status = 'locked'
- `auditDelete(user)` → setzt modify_status = 'deleted'

### Soft Delete

Datensätze werden **niemals physisch gelöscht**.
Löschen = `modify_status = 'deleted'`. Alle Abfragen filtern `modify_status != 'deleted'`.

### Natural Key Rename (monitor_name)

`mdm_monitor.monitor_name` kann umbenannt werden. Die FK-Constraint auf `mdm_monitor_variable` ist mit
`ON UPDATE CASCADE` definiert — Umbenennung des Parent-Rows aktualisiert alle Child-Rows automatisch.
Wird in einer `better-sqlite3`-Transaktion ausgeführt (inkl. Duplikat-Prüfung vor der Umbenennung).

---

## Architektur & Konventionen

### API-Routen

- Jede Route prüft zuerst die Session: `auth.api.getSession({ headers: request.headers })`
- Rückgabe immer als `Response.json(...)`
- Fehler: `{ error: "Meldung" }` mit passendem HTTP-Status
- `lock` und `unlock` werden als `action`-Parameter im PUT-Body übergeben

### UI-Muster: 3-Dialog-Prinzip

Alle Hauptbereiche folgen dem Muster:

1. **Suchmaske** — Suchfelder + Button "Suche"
2. **Ergebnisliste** — Tabelle, Klick auf Zeile → Detail
3. **Detailseite** — Formular mit Tabs für komplexe Entitäten

### Navigation: Zurück zur Ergebnisliste

**Problem:** React-State geht beim Navigieren verloren.

**Lösung:**
- Suchparameter werden in der URL gespeichert (`router.replace('/projects?...')`)
- Beim Mount: URL-Parameter lesen → Suche automatisch ausführen
- Zuletzt angeklickte Zeile in `sessionStorage` speichern
- Nach dem Rendern: `scrollIntoView()` + Zeile hervorheben (`bg-blue-100`, `font-bold`)

### Monitor-URL-Muster

Monitor-Detailseite verwendet Query-Parameter statt URL-Segment für den Namen (da Leerzeichen häufig):
`/monitors/[projectName]?monitor=monitorName`

### Sperren / Freigabe

- **Sperren** (gelber Button) → `PUT { action: "lock" }` → `modify_status = 'locked'`
- **Freigabe** (grüner Button) → `PUT { action: "unlock" }` → `modify_status = 'updated'`
- Alle Buttons sind auch im gesperrten Zustand sichtbar und nutzbar
- API-Routen erlauben Änderungen auch an gesperrten Datensätzen

### Kopieren von Datensätzen

- "Kopieren"-Button navigiert zu `/<entity>/<key>?copy=1`
- Im Kopie-Modus: Daten werden geladen, Key-Feld ist editierbar, vorausgefüllt mit `_KOPIE`-Suffix
- Erst nach "Speichern" wird der neue Datensatz angelegt

### SPS-Interface-Datei

Erzeugt eine `.html`-Datei im Verzeichnis `data/` mit der JSON-Struktur für den Siemens HMI-Import:
```
{
  "MonitorName" {
    "VarName": :="MonitorName".VarName:,
    ...
  }
}
```
- Devices: `POST /api/sps-interface` → `data/<DeviceName>.html`
- Monitors: `POST /api/monitor-interface` → `data/<MonitorName>.html`

### CSV-Import

- Separator wird automatisch erkannt (`;` oder `,`, basierend auf Häufigkeit in der Header-Zeile)
- Encoding wählbar: UTF-8 (Standard), Windows-1252 (Siemens SPS), ISO-8859-1
- Import-Typen: `projects`, `devices`, `alarms`, `emails`, `lookups`, `variables`, `monitor_variables`
- Protokollierung in `mdm_import_log`

### Formular-Tabs (Projekte)

| Tab | Felder |
|---|---|
| Allgemein | ProjektName, Bezeichnung, Kurzbeschreibung, ProjektTyp |
| Adresse | Straße, Hausnummer, PLZ, Stadt, Land |
| Technik | IP-Adressen, Alarm-Intervall, Alarm-Count-Limit |
| Alarmstufen | Liste + Hinzufügen/Löschen |
| Ziel-E-Mails | Liste + Hinzufügen/Löschen |

### Formular-Tabs (Devices)

| Tab | Felder |
|---|---|
| Allgemein | ProjektName, DeviceName, Bezeichnung, Typ, Status |
| Beschreibung | Freitext / Kurzbeschreibung |
| Limits | Limit-Min-Wert, Limit-Max-Wert |
| Alarm | Alarm-Meldung, Alarm-Stufe, Alarm-Zeitpunkt |
| Technische Daten | JSON-Freifeld |
| Variablen | Liste + Hinzufügen/Löschen |

### Formular-Tabs (Monitors)

| Tab | Felder |
|---|---|
| Allgemein | ProjektName, MonitorName (immer editierbar), Bezeichnung, Status, Typ (Lookup 400), Datenbaustein |
| Beschreibung | Freitext / Kurzbeschreibung |
| Technische Daten | JSON-Freifeld |
| Variablen | Liste + Hinzufügen / Ändern (inline) / Löschen |

---

## Aktueller Implementierungsstand (Stand 2026-04-22)

| Bereich | Status | Anmerkung |
|---|---|---|
| Login / Signup | ✅ fertig | better-auth, Email+Password |
| Dashboard | ✅ fertig | 2-Ebenen, 5 Sektionen, aktiv/geplant |
| Projekte | ✅ fertig | Suche, Liste, Detail (5 Tabs), Kopieren, Sperren/Freigabe, Test-E-Mail |
| Devices | ✅ fertig | Suche, Liste, Detail (6 Tabs inkl. Variablen), Sperren/Freigabe, SPS-Interface |
| Monitors | ✅ fertig | Suche, Liste, Detail (4 Tabs inkl. Variablen inline-edit), Typ-Badge, SPS-Interface |
| Alarme | ✅ fertig | Suche, Liste, Detail-Dialog (Neu/Bearbeiten/Löschen) |
| Import | ✅ fertig | CSV-Upload, Encoding-Auswahl, auto-detect Separator |
| Export | ✅ fertig | CSV-Download |
| Reports | 🔲 offen | Nur Platzhalter-Seite |
| Lookup-Verwaltung | 🔲 offen | Nur Seed-Daten, keine UI |
| Cloud-Sync (REST) | 🔲 offen | Noch nicht implementiert |
| Benutzer & Rollen | ✅ fertig | Liste, Neu, Bearbeiten, Sperren/Entsperren, Passwort setzen (nur Admins) |

---

## Offene Themen / Nächste Schritte

1. **Reports-Seite** ausbauen (aktive Projekte, Devices mit Alarm, Devices ohne Limits, …)
2. **Lookup-Verwaltung** — UI für `mdm_lookup` (Dropdowns befüllen)
3. **Event Rules / Events / Actions** — Monitoring-Unterbereich (Dashboard: geplant)
4. **Cloud-Sync** — REST-API-Anbindung an Ella-Energy (AWS)
5. ~~**Passwort ändern / Benutzer-Verwaltung**~~ — ✅ implementiert (Liste, Neu, Bearbeiten, Sperren, Passwort setzen; nur für Admins)

---

## Wichtige Entscheidungen

- **Kein physisches Löschen** — immer Soft Delete
- **Audit-Felder in der App** — nicht per DB-Trigger (SQLite-Trigger haben Rekursionsprobleme)
- **SQLite-Singleton** — `getDb()` in `src/lib/db/db.ts`, Schema wird automatisch beim ersten Aufruf angelegt
- **`src/app/` als App Router** — Root-`app/`-Verzeichnis darf nicht existieren (würde `src/app/` überschatten)
- **Suchstate in URL** — ermöglicht Browser-Back zur gefüllten Ergebnisliste
- **sessionStorage für Scroll** — speichert den zuletzt angeklickten Datensatz für Scroll + Highlight
- **Monitor-Name als Query-Param** — `/monitors/[projectName]?monitor=name` statt URL-Segment (Leerzeichen-kompatibel)
- **ON UPDATE CASCADE** — FK von `mdm_monitor_variable` auf `mdm_monitor` ermöglicht atomares Umbenennen

---

## Bekannte Stolperfallen

- **Leeres `app/`-Verzeichnis im Root** zerstört das gesamte Routing (Next.js bevorzugt `app/` vor `src/app/`)
- **`bunx tsc --noEmit`** zeigt Fehler aus `.next/`-Verzeichnis — diese ignorieren, nur Fehler ohne `.next/` im Pfad sind relevant
- **`better-auth` Base-URL** — muss in Scripts als `process.env.BETTER_AUTH_URL` gesetzt werden
- **Seed-Script** — verwendet Top-Level-await in einer `async function main()` wegen CJS-Kompatibilität
- **SQLite ALTER COLUMN** — nicht unterstützt; Schema-Änderungen an bestehenden Spalten erfordern Table-Recreate-Pattern
- **`title` in `mdm_monitor_variable`** — nullable (TEXT ohne NOT NULL), da Siemens-SPS-Exporte dieses Feld oft leer lassen
