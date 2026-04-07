# Technische Spezifikation — Projekt: Ella_MDM1

## 1. Zielsetzung

Ella_MDM1 ist ein kleines, ressourcenschonendes Master Data Management System (MDM-System) für den lokalen Edge-Betrieb.

Die Anwendung dient der Verwaltung von:

- Projekten
- Devices
- projektbezogenen Alarmstufen
- projektbezogenen Ziel-E-Mail-Adressen
- Lookup-Werten für DropDown-Listen

Die Anwendung ist als Web-Applikation ausgeführt und läuft lokal auf einem Edge-Gerät mit begrenzten Ressourcen. Sie ist an die Cloud-Plattform Ella-Energy angebunden und unterstützt den Datenaustausch über:

- REST-API
- Excel-/CSV-Import
- Export-Funktionen

---

## 2. Technologiestack

### 2.1 Frontend / Web-App

- Next.js
- Bun
- TypeScript
- TailwindCSS

### 2.2 Authentifizierung

- better-auth

### 2.3 Rich Text Editor

- TipTap

Verwendete Rich-Text-Formate:

- Bold
- Italic
- Heading Level 1–3
- Normal Text
- Inline Code
- Code Blöcke
- Bullet Lists
- Horizontal Separator

### 2.4 Datenbank

- SQLite
- SQL-Client: sqlite3 CLI
- Speicherung strukturierter Zusatzinformationen teilweise als JSON in SQLite

---

## 3. Fachliches Datenmodell

### 3.1 Hauptobjekte

**Projekt**

Ein Projekt ist die übergeordnete Einheit. Ein Projekt enthält:

- Stammdaten
- technische Parameter
- Alarmstufen
- Ziel-E-Mail-Adressen
- Devices

**Device**

Ein Device gehört immer genau zu einem Projekt.

Primärschlüssel Device: `project_name + device_name`

**Alarmstufen**

Zu jedem Projekt können mehrere Alarmstufen mit Alarmtexten definiert werden.

**Ziel-E-Mail-Adressen**

Zu jedem Projekt können mehrere Ziel-E-Mail-Adressen definiert werden.

**Lookup-Werte**

Lookup-Werte dienen als Quelle für DropDown-Listen, z. B.:

- Device-Typ
- Projekt-Typ

---

## 4. Fachliche Anforderungen

### 4.1 Projekte

Zu einem Projekt werden folgende Daten verwaltet:

**Pflichtfelder**

- ProjektName (eindeutig)
- Bezeichnung

**Optionale Felder**

- Kurzbeschreibung
- ProjektTyp
- Adresse
- technische Angaben:
  - IP-Adressen
  - Alarm-Intervalle
  - Alarm-Counts

### 4.2 Devices

Zu einem Device werden folgende Daten verwaltet:

**Pflichtfelder**

- ProjektName
- DeviceName
- Bezeichnung
- Typ
- Status (aktiv/inaktiv)

**Optionale Detailinformationen**

- Kurzbeschreibung
- Limit-Min-Wert
- Limit-Max-Wert
- Alarm-Meldung Y/N
- Alarm-Zeitpunkt
- Alarm-Stufe

### 4.3 Alarmstufen pro Projekt

Ein Projekt kann mehrere Alarmstufen besitzen:

- Alarm-Stufe
- Alarm-Text

### 4.4 Ziel-E-Mail-Adressen pro Projekt

Ein Projekt kann mehrere Ziel-E-Mail-Adressen besitzen.

### 4.5 Technische Audit-Felder in allen Tabellen

Jede Tabelle enthält:

- `create_user`
- `create_timestamp`
- `modify_user`
- `modify_timestamp`
- `modify_status`

Erlaubte Werte für `modify_status`:

- `inserted`
- `updated`
- `locked`
- `deleted`

---

## 5. Nichtfunktionale Anforderungen

### 5.1 Edge-Fähigkeit

Die Anwendung muss lokal auf schwächerer Hardware lauffähig sein:

- geringer Speicherbedarf
- kleine Datenbank
- einfache Deployment-Struktur
- keine Abhängigkeit von schwergewichtigen Diensten

### 5.2 Synchronisation mit Cloud

Ella_MDM1 ist lokales Stammdaten-Frontend für Edge-Betrieb. Die Cloud-Anwendung Ella-Energy läuft auf AWS.

Daher muss Ella_MDM1 Daten empfangen und senden können über:

- REST-API
- CSV-Import / CSV-Export

### 5.3 Performanz

Die Datenmenge ist überschaubar, daher reicht SQLite gut aus. Wichtig sind:

- Indizes auf Suchfelder
- einfache SQL-Struktur
- klare Transaktionslogik

---

## 6. Berechtigungsmodell

### 6.1 Benutzer

Nur authentifizierte Benutzer dürfen mit Daten arbeiten.

### 6.2 Rechte auf Datensatzebene

Authenticated User dürfen:

- create
- view
- update
- delete

### 6.3 Sperren

Zusätzlich gibt es die Funktion sperren. Ein gesperrter Datensatz erhält:

```
modify_status = 'locked'
```

Ein gesperrter Datensatz darf in der UI nur lesbar angezeigt werden, außer ein berechtigter Prozess oder Administrator hebt die Sperre wieder auf.

---

## 7. GUI- und Bedienkonzept

### 7.1 Hauptmenü

Die Menüstruktur enthält:

- Projekte
- Alarme
- Devices
- Reports
- Import
- Export

### 7.2 Einheitliches 3-Dialog-Prinzip

Jeder Funktionsbereich folgt demselben Ablauf:

**1. Suche**

Beispiel Devices: Suchfelder wie DeviceName, Bezeichnung, Typ, Status → Button `<Suche>`

**2. Auswahl-Liste**

Ergebnisliste der gefundenen Datensätze. Beispiel Devices:

- DeviceName
- Bezeichnung
- Status

**3. Detail-Eingabe-Maske**

Beim Klick auf eine Ergebniszeile öffnet sich die Eingabemaske mit allen Feldern. Je nach Berechtigung: editierbar oder nur Anzeige.

Zusatzinformationen wie Limits werden in Tabsheets dargestellt.

### 7.3 Aktionsbuttons in Detailmasken

Links:

- `<abbrechen>`

Rechts:

- `<sperren>`
- `<löschen>`
- `<neuanlage>`
- `<kopieren>`
- `<speichern>`

### 7.4 Löschdialog

Beim Löschen erscheint:

> „Wollen Sie den Datensatz wirklich löschen? Ja/Nein"

Empfohlen wird Soft Delete:

```
modify_status = 'deleted'
```

Physisches Löschen sollte optional nur administrativ erfolgen.

---

## 8. REST-API-Grundidee

Die lokale App benötigt interne API-Endpunkte für UI, Cloud-Schnittstelle und Import.

### 8.1 Beispiel-Endpunkte

```
GET    /api/projects
GET    /api/projects/:projectName
POST   /api/projects
PUT    /api/projects/:projectName
DELETE /api/projects/:projectName

GET    /api/devices
GET    /api/devices/:projectName/:deviceName
POST   /api/devices
PUT    /api/devices/:projectName/:deviceName
DELETE /api/devices/:projectName/:deviceName

GET    /api/lookups?function=100
GET    /api/project-alarms?projectName=...
GET    /api/project-emails?projectName=...
```

### 8.2 Import / Export

- CSV-Import für Projekte und Devices
- Export als CSV
- optional JSON-Export für Cloud-Sync

---

## 9. Datenmodell – Tabellenübersicht

### 9.1 Applikationstabellen (MDM)

- `mdm_project`
- `mdm_device`
- `mdm_project_alarm`
- `mdm_project_email`
- `mdm_lookup`
- optional: `mdm_import_log`
- optional: `mdm_sync_log`

### 9.2 better-auth Tabellen (Authentifizierung)

better-auth verwaltet folgende Tabellen eigenständig:

- `user` — Benutzerkonten
- `session` — aktive Sitzungen
- `account` — verknüpfte Anmeldemethoden (Credential, OAuth)
- `verification` — E-Mail-Verifizierung

---

## 10. Datenbankdesign SQLite

Wichtige Designentscheidung:

- strukturierte Kernfelder als normale SQL-Spalten
- flexible Zusatzinformationen als JSON-Text mit `CHECK(json_valid(...))`

So bleibt das System:

- leichtgewichtig
- gut suchbar
- trotzdem flexibel

---

## 11. CREATE STATEMENTS

### 11.1 SQLite-Pragmas

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
```

### 11.2 better-auth Tabellen

Diese Tabellen werden von better-auth benötigt und können per CLI automatisch angelegt werden (`npx auth@latest migrate`).

```sql
CREATE TABLE IF NOT EXISTS user (
    id              TEXT    NOT NULL PRIMARY KEY,
    name            TEXT    NOT NULL,
    email           TEXT    NOT NULL UNIQUE,
    email_verified  INTEGER NOT NULL DEFAULT 0,
    image           TEXT,
    created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session (
    id          TEXT    NOT NULL PRIMARY KEY,
    user_id     TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    token       TEXT    NOT NULL UNIQUE,
    expires_at  TEXT    NOT NULL,
    ip_address  TEXT,
    user_agent  TEXT,
    created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account (
    id                       TEXT    NOT NULL PRIMARY KEY,
    user_id                  TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    account_id               TEXT    NOT NULL,
    provider_id              TEXT    NOT NULL,
    access_token             TEXT,
    refresh_token            TEXT,
    access_token_expires_at  TEXT,
    refresh_token_expires_at TEXT,
    scope                    TEXT,
    id_token                 TEXT,
    password                 TEXT,
    created_at               TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification (
    id          TEXT    NOT NULL PRIMARY KEY,
    identifier  TEXT    NOT NULL,
    value       TEXT    NOT NULL,
    expires_at  TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 11.3 Lookup-Tabelle

Diese Tabelle liefert Werte für DropDown-Listen.

Beispiele:
- Funktion 100 = Device-Typ
- Funktion 200 = Projekt-Typ

```sql
CREATE TABLE IF NOT EXISTS mdm_lookup (
    function_code      INTEGER NOT NULL,
    code               TEXT    NOT NULL,
    description        TEXT    NOT NULL,
    function_text      TEXT,

    create_user        TEXT    NOT NULL,
    create_timestamp   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user        TEXT    NOT NULL,
    modify_timestamp   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status      TEXT    NOT NULL DEFAULT 'inserted'
                              CHECK (modify_status IN ('inserted','updated','locked','deleted')),

    PRIMARY KEY (function_code, code)
);
```

### 11.4 Projekt-Tabelle

Die Adresse und technische Zusatzangaben werden teilweise als JSON gespeichert.

```sql
CREATE TABLE IF NOT EXISTS mdm_project (
    project_name           TEXT    NOT NULL,
    title                  TEXT    NOT NULL,
    short_description      TEXT,
    project_type_code      TEXT,

    street                 TEXT,
    house_no               TEXT,
    postal_code            TEXT,
    city                   TEXT,
    country                TEXT,

    primary_ip_address     TEXT,
    secondary_ip_address   TEXT,
    alarm_interval_sec     INTEGER,
    alarm_count_limit      INTEGER,

    technical_json         TEXT
                           CHECK (technical_json IS NULL OR json_valid(technical_json)),

    create_user            TEXT    NOT NULL,
    create_timestamp       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user            TEXT    NOT NULL,
    modify_timestamp       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status          TEXT    NOT NULL DEFAULT 'inserted'
                                  CHECK (modify_status IN ('inserted','updated','locked','deleted')),

    PRIMARY KEY (project_name)
);
```

> **Hinweis:** `project_type_code` wird logisch gegen `function_code = 200` geprüft — das macht die Applikation.

### 11.5 Device-Tabelle

Primärschlüssel: `project_name + device_name`

Rich-Text-Kurzbeschreibung wird als TipTap-JSON gespeichert.

```sql
CREATE TABLE IF NOT EXISTS mdm_device (
    project_name             TEXT    NOT NULL,
    device_name              TEXT    NOT NULL,
    title                    TEXT    NOT NULL,
    device_type_code         TEXT    NOT NULL,
    status                   TEXT    NOT NULL
                                     CHECK (status IN ('active','inactive')),

    short_description_json   TEXT
                                     CHECK (short_description_json IS NULL OR json_valid(short_description_json)),

    limit_min_value          REAL,
    limit_max_value          REAL,

    alarm_enabled            INTEGER NOT NULL DEFAULT 0
                                     CHECK (alarm_enabled IN (0,1)),
    alarm_timestamp          TEXT,
    alarm_level_code         TEXT,

    detail_json              TEXT
                                     CHECK (detail_json IS NULL OR json_valid(detail_json)),

    create_user              TEXT    NOT NULL,
    create_timestamp         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user              TEXT    NOT NULL,
    modify_timestamp         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status            TEXT    NOT NULL DEFAULT 'inserted'
                                       CHECK (modify_status IN ('inserted','updated','locked','deleted')),

    PRIMARY KEY (project_name, device_name),

    FOREIGN KEY (project_name)
        REFERENCES mdm_project(project_name)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);
```

### 11.6 Projekt-Alarmstufen

Ein Projekt kann mehrere Alarmstufen mit Alarmtexten haben.

```sql
CREATE TABLE IF NOT EXISTS mdm_project_alarm (
    project_name          TEXT    NOT NULL,
    alarm_level_code      TEXT    NOT NULL,
    alarm_text            TEXT    NOT NULL,
    severity_rank         INTEGER,

    create_user           TEXT    NOT NULL,
    create_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user           TEXT    NOT NULL,
    modify_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status         TEXT    NOT NULL DEFAULT 'inserted'
                                 CHECK (modify_status IN ('inserted','updated','locked','deleted')),

    PRIMARY KEY (project_name, alarm_level_code),

    FOREIGN KEY (project_name)
        REFERENCES mdm_project(project_name)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);
```

### 11.7 Projekt-Ziel-E-Mail-Adressen

```sql
CREATE TABLE IF NOT EXISTS mdm_project_email (
    project_name          TEXT    NOT NULL,
    email_address         TEXT    NOT NULL,
    email_purpose         TEXT,
    is_active             INTEGER NOT NULL DEFAULT 1
                                 CHECK (is_active IN (0,1)),

    create_user           TEXT    NOT NULL,
    create_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user           TEXT    NOT NULL,
    modify_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status         TEXT    NOT NULL DEFAULT 'inserted'
                                 CHECK (modify_status IN ('inserted','updated','locked','deleted')),

    PRIMARY KEY (project_name, email_address),

    FOREIGN KEY (project_name)
        REFERENCES mdm_project(project_name)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);
```

### 11.8 Import-Log

Für CSV/Excel-Import empfehlenswert.

```sql
CREATE TABLE IF NOT EXISTS mdm_import_log (
    import_id             TEXT    NOT NULL,
    import_type           TEXT    NOT NULL,
    source_filename       TEXT,
    started_at            TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at           TEXT,
    imported_by           TEXT    NOT NULL,
    status                TEXT    NOT NULL
                                 CHECK (status IN ('running','success','warning','error')),
    message               TEXT,
    result_json           TEXT
                                 CHECK (result_json IS NULL OR json_valid(result_json)),

    PRIMARY KEY (import_id)
);
```

### 11.9 Sync-Log

Für Cloud-Synchronisation sehr sinnvoll.

```sql
CREATE TABLE IF NOT EXISTS mdm_sync_log (
    sync_id               TEXT    NOT NULL,
    sync_direction        TEXT    NOT NULL
                                 CHECK (sync_direction IN ('inbound','outbound')),
    entity_name           TEXT    NOT NULL,
    entity_key            TEXT    NOT NULL,
    sync_timestamp        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                TEXT    NOT NULL
                                 CHECK (status IN ('success','error','conflict')),
    message               TEXT,
    payload_json          TEXT
                                 CHECK (payload_json IS NULL OR json_valid(payload_json)),

    PRIMARY KEY (sync_id)
);
```

---

## 12. Indizes

Für Suche und Listen sind diese Indizes sinnvoll:

```sql
CREATE INDEX IF NOT EXISTS idx_project_title        ON mdm_project(title);
CREATE INDEX IF NOT EXISTS idx_project_type_code    ON mdm_project(project_type_code);
CREATE INDEX IF NOT EXISTS idx_project_status       ON mdm_project(modify_status);

CREATE INDEX IF NOT EXISTS idx_device_title         ON mdm_device(title);
CREATE INDEX IF NOT EXISTS idx_device_type_code     ON mdm_device(device_type_code);
CREATE INDEX IF NOT EXISTS idx_device_status        ON mdm_device(status);
CREATE INDEX IF NOT EXISTS idx_device_project       ON mdm_device(project_name);
CREATE INDEX IF NOT EXISTS idx_device_modify_status ON mdm_device(modify_status);

CREATE INDEX IF NOT EXISTS idx_alarm_project        ON mdm_project_alarm(project_name);
CREATE INDEX IF NOT EXISTS idx_email_project        ON mdm_project_email(project_name);
```

---

## 13. Trigger für automatische Änderungsfelder

SQLite hat keine `ON UPDATE CURRENT_TIMESTAMP`-Spalte wie andere DBs. Daher sind Trigger möglich — aber in der Praxis ist es bei Next.js/TypeScript sauberer, diese Felder in der Applikation zu setzen.

### 13.1 Beispiel für mdm_project

```sql
CREATE TRIGGER IF NOT EXISTS trg_mdm_project_modify_timestamp
AFTER UPDATE ON mdm_project
FOR EACH ROW
BEGIN
    UPDATE mdm_project
       SET modify_timestamp = CURRENT_TIMESTAMP
     WHERE project_name = NEW.project_name;
END;
```

### 13.2 Beispiel für mdm_device

```sql
CREATE TRIGGER IF NOT EXISTS trg_mdm_device_modify_timestamp
AFTER UPDATE ON mdm_device
FOR EACH ROW
BEGIN
    UPDATE mdm_device
       SET modify_timestamp = CURRENT_TIMESTAMP
     WHERE project_name = NEW.project_name
       AND device_name  = NEW.device_name;
END;
```

> **Hinweis:** In SQLite können solche Trigger je nach Einstellung rekursiv problematisch sein. Empfohlen: `modify_timestamp`, `modify_user` und `modify_status` in der Applikation beim Speichern setzen.

---

## 14. Empfohlene Applikationslogik für Auditfelder

### Beim Insert

```
create_user      = currentUser
create_timestamp = CURRENT_TIMESTAMP
modify_user      = currentUser
modify_timestamp = CURRENT_TIMESTAMP
modify_status    = 'inserted'
```

### Beim Update

```
modify_user      = currentUser
modify_timestamp = CURRENT_TIMESTAMP
modify_status    = 'updated'
```

### Beim Sperren

```
modify_user      = currentUser
modify_timestamp = CURRENT_TIMESTAMP
modify_status    = 'locked'
```

### Beim Löschen (Soft Delete)

```
modify_user      = currentUser
modify_timestamp = CURRENT_TIMESTAMP
modify_status    = 'deleted'
```

---

## 15. Lookup-Konzept

Die Lookup-Tabelle wird fachlich über `function_code` gruppiert.

### Beispielwerte

**Device-Typ** (`function_code = 100`)

| code | description |
|------|-------------|
| 1    | Sensor      |
| 2    | Motor       |

**Projekt-Typ** (`function_code = 200`)

| code | description |
|------|-------------|
| 1    | Kraftwerk   |
| 2    | Anlage      |

### Beispiel Inserts

```sql
INSERT INTO mdm_lookup (function_code, code, description, function_text, create_user, modify_user, modify_status)
VALUES
  (100, '1', 'Sensor',    'DeviceType',  'system', 'system', 'inserted'),
  (100, '2', 'Motor',     'DeviceType',  'system', 'system', 'inserted'),
  (200, '1', 'Kraftwerk', 'ProjectType', 'system', 'system', 'inserted'),
  (200, '2', 'Anlage',    'ProjectType', 'system', 'system', 'inserted');
```

---

## 16. JSON-Nutzung in SQLite

### 16.1 Warum JSON?

Weil das System lokal und leichtgewichtig sein soll. JSON ist sinnvoll für:

- TipTap-Inhalte
- flexible technische Zusatzfelder
- spätere Erweiterungen ohne Schemaänderung

### 16.2 Empfohlene JSON-Felder

**In `mdm_project`:** `technical_json`

```json
{
  "plc": { "vendor": "Siemens", "series": "S7-1500" },
  "network": { "subnet": "192.168.0.0/24" },
  "alarm": { "retryIntervalSec": 60, "maxCount": 5 }
}
```

**In `mdm_device`:** `short_description_json`, `detail_json`

```json
{
  "unit": "°C",
  "plcTag": "DB10.DBW2",
  "location": "Maschine 3",
  "manufacturer": "Siemens",
  "notes": "Wartung halbjährlich"
}
```

---

## 17. UI-Spezifikation

### 17.1 Seitenstruktur

```
/login
/signup
/dashboard
/projects
/alarms
/devices
/reports
/import
/export
```

### 17.2 Layout

- linke Navigation oder Top-Menü
- Suchbereich oben
- Ergebnisliste mittig
- Detailbereich als Seite oder Dialog

### 17.3 Devices-Detail

Empfohlene Tabs:

- Allgemein
- Beschreibung
- Limits
- Alarm
- Technische Daten

### 17.4 Projekte-Detail

Empfohlene Tabs:

- Allgemein
- Adresse
- Technik
- Alarmstufen
- Ziel-E-Mails

---

## 18. Validierungen

### 18.1 Projekt

- `project_name` eindeutig
- Pflichtfeld: `title`
- IP-Adressen optional formal validieren
- `alarm_interval_sec >= 0`
- `alarm_count_limit >= 0`

### 18.2 Device

- `device_name` innerhalb Projekt eindeutig
- `status` nur `active` | `inactive`
- `alarm_enabled` nur `0` | `1`
- wenn `limit_min_value` und `limit_max_value` gesetzt: `limit_min_value <= limit_max_value`

### 18.3 E-Mail

Formatvalidierung auf UI- und API-Ebene.

---

## 19. Suchmasken

### 19.1 Projekte

Suchfelder:

- ProjektName
- Bezeichnung
- ProjektTyp
- Stadt
- Status

### 19.2 Devices

Suchfelder:

- ProjektName
- DeviceName
- Bezeichnung
- Typ
- Status
- Alarm-Meldung

### 19.3 Alarme

Suchfelder:

- ProjektName
- Alarm-Stufe
- Alarm-Text

---

## 20. Reports

Mögliche Reports:

- alle aktiven Projekte
- alle aktiven Devices je Projekt
- Devices mit Alarm aktiv
- Devices ohne Limits
- Projekte mit Ziel-E-Mail-Adressen
- Exportliste für Cloud-Sync

---

## 21. Import / Export

### 21.1 CSV-Import

Unterstützte Importobjekte:

- Projekte
- Devices
- Projekt-Alarmstufen
- Projekt-E-Mail-Adressen
- Lookups

### 21.2 Import-Regeln

- Validierung vor Speichern
- Fehlerprotokoll in `mdm_import_log`
- Import als Upsert möglich: neu anlegen oder vorhandene aktualisieren

### 21.3 Export

- CSV-Export
- JSON-Export
- optional projektbezogener Voll-Export

---

## 22. Empfohlene Verzeichnisstruktur Next.js

```
src/
  app/
    login/
    signup/
    dashboard/
    projects/
    alarms/
    devices/
    reports/
    import/
    export/
    api/
      projects/
      devices/
      alarms/
      emails/
      lookups/
      import/
      export/
  components/
    forms/
    lists/
    dialogs/
    tabs/
    editor/
  lib/
    db/
    auth/
    validation/
    lookup/
    audit/
    import/
    export/
  types/
```

---

## 23. Empfohlene TypeScript-Modelle

### Projekt

```typescript
type ModifyStatus = "inserted" | "updated" | "locked" | "deleted";

interface Project {
  projectName: string;
  title: string;
  shortDescription?: string;
  projectTypeCode?: string;
  street?: string;
  houseNo?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  primaryIpAddress?: string;
  secondaryIpAddress?: string;
  alarmIntervalSec?: number;
  alarmCountLimit?: number;
  technicalJson?: unknown;
  createUser: string;
  createTimestamp: string;
  modifyUser: string;
  modifyTimestamp: string;
  modifyStatus: ModifyStatus;
}
```

### Device

```typescript
interface Device {
  projectName: string;
  deviceName: string;
  title: string;
  deviceTypeCode: string;
  status: "active" | "inactive";
  shortDescriptionJson?: unknown;
  limitMinValue?: number;
  limitMaxValue?: number;
  alarmEnabled: 0 | 1;
  alarmTimestamp?: string;
  alarmLevelCode?: string;
  detailJson?: unknown;
  createUser: string;
  createTimestamp: string;
  modifyUser: string;
  modifyTimestamp: string;
  modifyStatus: ModifyStatus;
}
```

---

## 24. Architekturempfehlung

Für Ella_MDM1 wird folgende Architektur empfohlen:

- normalisierte Kerntabellen für Projekte, Devices, Alarme, E-Mails, Lookups
- JSON-Felder nur für flexible Zusatzdaten
- Soft Delete statt physischem Löschen
- Auditfelder in der Applikation setzen, nicht primär per Trigger
- Lookup-Prüfung logisch in TypeScript
- CSV-Import mit Import-Log
- Sync-Log für Cloud-Anbindung

So bleibt die Lösung:

- einfach
- robust
- edge-tauglich
- später erweiterbar
