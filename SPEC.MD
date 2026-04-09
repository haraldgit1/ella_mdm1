# Technische Spezifikation — Ella MDM1

> **Stand:** Version 1 — 2026-04-09
> **Status:** Produktiv lauffähig. Kernfunktionen implementiert.

---

## 1. Zielsetzung

**Ella MDM1** ist ein leichtgewichtiges Master Data Management System für den lokalen Edge-Betrieb,
angebunden an die Cloud-Plattform Ella-Energy (AWS).

Die Anwendung verwaltet:

- Projekte
- Devices (einem Projekt zugeordnet)
- Alarmstufen pro Projekt
- Ziel-E-Mail-Adressen pro Projekt
- Lookup-Werte für Dropdown-Listen

Der Datenaustausch mit der Cloud erfolgt über:

- REST-API
- CSV-Import / CSV-Export

---

## 2. Technologiestack

| Bereich | Technologie | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.2 |
| Runtime | Bun | aktuell |
| Sprache | TypeScript | 5.x (strict) |
| Styling | TailwindCSS | 4.x |
| Datenbank | SQLite (`better-sqlite3`) | 12.x |
| Authentifizierung | better-auth | 1.6.x |
| Paketmanager | Bun + npm lock | — |

---

## 3. Fachliches Datenmodell

### 3.1 Hauptobjekte

**Projekt**
- Übergeordnete Einheit
- Enthält: Stammdaten, Adresse, technische Parameter, Alarmstufen, E-Mail-Adressen, Devices

**Device**
- Gehört immer genau zu einem Projekt
- Primärschlüssel: `project_name + device_name`

**Alarmstufen**
- Projektbezogen: `project_name + alarm_level_code`
- Felder: `alarm_level_code`, `alarm_text`, `severity_rank`

**Ziel-E-Mail-Adressen**
- Projektbezogen: `project_name + email_address`
- Felder: `email_address`, `email_purpose`, `is_active`

**Lookup-Werte**
- Quelle für Dropdown-Listen, gruppiert nach `function_code`
- `function_code = 100` → DeviceType
- `function_code = 200` → ProjectType

### 3.2 Audit-Felder

Alle MDM-Tabellen enthalten:

| Feld | Beschreibung |
|---|---|
| `create_user` | Ersteller (E-Mail) |
| `create_timestamp` | Erstellzeitpunkt (ISO-Format) |
| `modify_user` | Letzter Bearbeiter |
| `modify_timestamp` | Letzter Änderungszeitpunkt |
| `modify_status` | `inserted` \| `updated` \| `locked` \| `deleted` |

**Wichtig:** Audit-Felder werden in der Applikation gesetzt (`src/lib/audit/audit.ts`), nicht per Trigger.

### 3.3 Soft Delete

Datensätze werden **niemals physisch gelöscht**.
Löschen = `modify_status = 'deleted'`. Alle Abfragen filtern `WHERE modify_status != 'deleted'`.

---

## 4. Datenbankschema

Das vollständige Schema liegt in `src/lib/db/schema.sql` und wird beim App-Start automatisch eingespielt.

### 4.1 mdm_project

```sql
CREATE TABLE IF NOT EXISTS mdm_project (
    project_name           TEXT    NOT NULL PRIMARY KEY,
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
    technical_json         TEXT    CHECK (technical_json IS NULL OR json_valid(technical_json)),
    create_user            TEXT    NOT NULL,
    create_timestamp       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user            TEXT    NOT NULL,
    modify_timestamp       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status          TEXT    NOT NULL DEFAULT 'inserted'
                                   CHECK (modify_status IN ('inserted','updated','locked','deleted'))
);
```

### 4.2 mdm_device

```sql
CREATE TABLE IF NOT EXISTS mdm_device (
    project_name             TEXT    NOT NULL,
    device_name              TEXT    NOT NULL,
    title                    TEXT    NOT NULL,
    device_type_code         TEXT    NOT NULL,
    status                   TEXT    NOT NULL CHECK (status IN ('active','inactive')),
    short_description_json   TEXT    CHECK (short_description_json IS NULL OR json_valid(short_description_json)),
    limit_min_value          REAL,
    limit_max_value          REAL,
    alarm_enabled            INTEGER NOT NULL DEFAULT 0 CHECK (alarm_enabled IN (0,1)),
    alarm_timestamp          TEXT,
    alarm_level_code         TEXT,
    detail_json              TEXT    CHECK (detail_json IS NULL OR json_valid(detail_json)),
    create_user              TEXT    NOT NULL,
    create_timestamp         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user              TEXT    NOT NULL,
    modify_timestamp         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status            TEXT    NOT NULL DEFAULT 'inserted'
                                     CHECK (modify_status IN ('inserted','updated','locked','deleted')),
    PRIMARY KEY (project_name, device_name),
    FOREIGN KEY (project_name) REFERENCES mdm_project(project_name)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
```

### 4.3 mdm_project_alarm

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
    FOREIGN KEY (project_name) REFERENCES mdm_project(project_name)
        ON UPDATE CASCADE ON DELETE CASCADE
);
```

### 4.4 mdm_project_email

```sql
CREATE TABLE IF NOT EXISTS mdm_project_email (
    project_name          TEXT    NOT NULL,
    email_address         TEXT    NOT NULL,
    email_purpose         TEXT,
    is_active             INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    create_user           TEXT    NOT NULL,
    create_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user           TEXT    NOT NULL,
    modify_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status         TEXT    NOT NULL DEFAULT 'inserted'
                                 CHECK (modify_status IN ('inserted','updated','locked','deleted')),
    PRIMARY KEY (project_name, email_address),
    FOREIGN KEY (project_name) REFERENCES mdm_project(project_name)
        ON UPDATE CASCADE ON DELETE CASCADE
);
```

### 4.5 mdm_lookup

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

### 4.6 mdm_import_log

```sql
CREATE TABLE IF NOT EXISTS mdm_import_log (
    import_id      TEXT NOT NULL PRIMARY KEY,
    import_type    TEXT NOT NULL,
    source_filename TEXT,
    started_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at    TEXT,
    imported_by    TEXT NOT NULL,
    status         TEXT NOT NULL CHECK (status IN ('running','success','warning','error')),
    message        TEXT,
    result_json    TEXT CHECK (result_json IS NULL OR json_valid(result_json))
);
```

### 4.7 mdm_sync_log

```sql
CREATE TABLE IF NOT EXISTS mdm_sync_log (
    sync_id        TEXT NOT NULL PRIMARY KEY,
    sync_direction TEXT NOT NULL CHECK (sync_direction IN ('inbound','outbound')),
    entity_name    TEXT NOT NULL,
    entity_key     TEXT NOT NULL,
    sync_timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status         TEXT NOT NULL CHECK (status IN ('success','error','conflict')),
    message        TEXT,
    payload_json   TEXT CHECK (payload_json IS NULL OR json_valid(payload_json))
);
```

---

## 5. API-Endpunkte

Alle Endpunkte erfordern eine aktive Session (better-auth Cookie).

### 5.1 Projekte

| Methode | URL | Beschreibung |
|---|---|---|
| GET | `/api/projects` | Suche (Query: `project_name`, `title`, `city`, `project_type_code`) |
| GET | `/api/projects/:projectName` | Einzelnes Projekt |
| POST | `/api/projects` | Neuanlage |
| PUT | `/api/projects/:projectName` | Ändern / `{ action: "lock" }` / `{ action: "unlock" }` |
| DELETE | `/api/projects/:projectName` | Soft Delete |

### 5.2 Devices

| Methode | URL | Beschreibung |
|---|---|---|
| GET | `/api/devices` | Suche (Query: `project_name`, `device_name`, `title`, `device_type_code`, `status`, `alarm_enabled`) |
| GET | `/api/devices/:projectName/:deviceName` | Einzelnes Device |
| POST | `/api/devices` | Neuanlage |
| PUT | `/api/devices/:projectName/:deviceName` | Ändern / `{ action: "lock" }` / `{ action: "unlock" }` |
| DELETE | `/api/devices/:projectName/:deviceName` | Soft Delete |

### 5.3 Alarmstufen

| Methode | URL | Beschreibung |
|---|---|---|
| GET | `/api/alarms` | Suche (Query: `project_name`, `alarm_level_code`, `alarm_text`) |
| POST | `/api/alarms` | Neuanlage |
| PUT | `/api/alarms/:projectName/:alarmLevelCode` | Alarm-Text + Rang ändern |
| DELETE | `/api/alarms/:projectName/:alarmLevelCode` | Soft Delete |

### 5.4 E-Mail-Adressen

| Methode | URL | Beschreibung |
|---|---|---|
| GET | `/api/emails?projectName=...` | E-Mails eines Projekts |
| POST | `/api/emails` | Neuanlage |
| DELETE | `/api/emails/:projectName/:emailAddress` | Soft Delete |

### 5.5 Lookups

| Methode | URL | Beschreibung |
|---|---|---|
| GET | `/api/lookups?function=100` | Lookup-Werte nach function_code |

### 5.6 Import / Export

| Methode | URL | Beschreibung |
|---|---|---|
| POST | `/api/import` | CSV-Upload (multipart/form-data) |
| GET | `/api/export` | CSV-Download |

---

## 6. GUI-Konzept

### 6.1 Routen

| Route | Seite |
|---|---|
| `/` | Redirect → `/login` |
| `/login` | Login |
| `/signup` | Registrierung |
| `/dashboard` | Startseite mit 6 Menü-Kacheln |
| `/projects` | Projekte: Suche + Ergebnisliste |
| `/projects/:projectName` | Projekt-Detail (5 Tabs) |
| `/devices` | Devices: Suche + Ergebnisliste |
| `/devices/:projectName/:deviceName` | Device-Detail (5 Tabs) |
| `/alarms` | Alarme: Suche + Liste + Dialog |
| `/reports` | Reports (Platzhalter) |
| `/import` | CSV-Import |
| `/export` | CSV-Export |

### 6.2 3-Dialog-Prinzip

Jeder Hauptbereich folgt dem Ablauf:

1. **Suchmaske** — Eingabefelder + Button "Suche"
2. **Ergebnisliste** — Tabelle, klickbare Zeilen; zuletzt geöffnete Zeile bleibt hervorgehoben (blau)
3. **Detailseite / Dialog** — Formular mit Tabs (komplex) oder Modal-Dialog (einfach)

### 6.3 Navigation: Zurück zur Ergebnisliste

- Suchparameter werden in der URL gespeichert (z.B. `/projects?project_name=WIND&searched=1`)
- "← Zurück"- und "Abbrechen"-Buttons verwenden `router.back()`
- Beim Zurücknavigieren: URL-Parameter triggern automatische Suche, zuletzt geöffnete Zeile wird gescrollt und hervorgehoben

### 6.4 Aktionsbuttons in Detailmasken

| Button | Farbe | Sichtbar |
|---|---|---|
| Abbrechen | grau (links) | immer |
| Freigabe | grün | nur wenn gesperrt |
| Sperren | gelb | nur wenn nicht gesperrt |
| Löschen | rot | bei bestehenden Datensätzen |
| Kopieren | grau | bei bestehenden Datensätzen |
| Neuanlage | grau | bei Neuanlage / Kopieren |
| Speichern | blau | immer |

> Alle Buttons sind auch bei gesperrten Datensätzen sichtbar und nutzbar.

### 6.5 Sperren / Freigabe

- **Sperren:** `modify_status = 'locked'`, gelber Badge im Header
- **Freigabe:** `modify_status = 'updated'` (Aktiv)
- In der Auswahlliste: gesperrte Datensätze zeigen "Gesperrt" statt "Aktiv/Inaktiv"

### 6.6 Kopieren

- Öffnet Detailformular mit vorausgefüllten Daten
- Key-Feld (ProjektName / DeviceName) ist editierbar, vorausgefüllt mit `_KOPIE`-Suffix
- Erst nach "Speichern" wird der neue Datensatz angelegt

---

## 7. Validierungen

### Projekte

- `project_name`: Pflichtfeld, eindeutig
- `title`: Pflichtfeld
- `alarm_interval_sec`, `alarm_count_limit`: ≥ 0

### Devices

- `project_name` + `device_name`: eindeutig
- `title`, `device_type_code`: Pflichtfelder
- `status`: nur `active` | `inactive`
- `alarm_enabled`: nur `0` | `1`
- `limit_min_value` ≤ `limit_max_value` (wenn beide gesetzt)

### Alarmstufen

- `project_name`, `alarm_level_code`, `alarm_text`: Pflichtfelder
- Kombination `project_name + alarm_level_code`: eindeutig

---

## 8. Berechtigungsmodell

### Authentifizierung

- better-auth mit Email/Password
- Alle API-Routen und Seiten erfordern aktive Session
- Nicht authentifizierte Requests → 401 / Redirect zu `/login`

### Datensatz-Operationen

Alle authentifizierten Benutzer dürfen: Anlegen, Lesen, Ändern, Löschen (Soft), Sperren, Freigeben.

> Hinweis: Rollenbasierte Zugriffskontrolle (z.B. nur Admins dürfen sperren) ist noch nicht implementiert.

---

## 9. Testdaten

Seed-Script: `src/lib/db/seed-testdata.ts`

```bash
bunx tsx src/lib/db/seed-testdata.ts
```

| Bereich | Inhalt |
|---|---|
| Benutzer | herbert1@test.local / Herbert1! |
| Projekte | WINDPARK-NORD, SOLARPARK-SÜD, BIOMASSE-WEST |
| Devices | 10 Geräte (WEA, Wechselrichter, Sensoren, Pumpen, Ventil) |
| Alarmstufen | KRIT / WARN / INFO je Projekt |
| E-Mail-Adressen | 5 Adressen (Alarm, Wartung, Report) |
| Lookups | 5× DeviceType, 4× ProjectType |

---

## 10. Implementierungsstand

| Bereich | Status | Anmerkung |
|---|---|---|
| Auth (Login/Signup) | ✅ fertig | |
| Dashboard | ✅ fertig | |
| Projekte CRUD | ✅ fertig | inkl. Kopieren, Sperren/Freigabe |
| Devices CRUD | ✅ fertig | inkl. Sperren/Freigabe |
| Alarme CRUD | ✅ fertig | standalone + im Projekt-Tab |
| E-Mails CRUD | ✅ fertig | im Projekt-Tab |
| CSV-Import | ✅ fertig | |
| CSV-Export | ✅ fertig | |
| Reports | 🔲 offen | Platzhalter-Seite |
| Lookup-Verwaltung UI | 🔲 offen | nur Seed-Daten |
| Cloud-Sync REST | 🔲 offen | |
| Passwort ändern | 🔲 offen | |
| Rollen / Berechtigungen | 🔲 offen | |

---

## 11. Offene Punkte / Nächste Version

1. **Reports** — aktive Projekte, Devices mit Alarm, Devices ohne Limits, Exportliste Cloud-Sync
2. **Lookup-Verwaltung** — UI zum Pflegen von `mdm_lookup` (DeviceType, ProjectType, weitere)
3. **Device kopieren** — analog zu Projekt-Kopieren mit editierbarem DeviceName
4. **Cloud-Sync** — REST-API-Anbindung an Ella-Energy (AWS), Nutzung von `mdm_sync_log`
5. **Benutzerverwaltung** — Passwort ändern, Rollen (Admin / Betrachter)
6. **Import erweitern** — Alarmstufen, E-Mails und Lookups per CSV importieren
