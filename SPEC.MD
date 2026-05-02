# Technische Spezifikation — Ella Edge Integration Hub

> **Stand:** Version 2 — 2026-05-02
> **Status:** Produktiv lauffähig. Kernfunktionen implementiert inkl. Monitoring, Meldungstexte und Zeitreihendaten.

---

## 1. Zielsetzung

**Ella Edge Integration Hub** (Ella MDM) ist ein leichtgewichtiges Master Data Management System
für den lokalen Edge-Betrieb, angebunden an die Cloud-Plattform Ella-Energy (AWS).

Die Anwendung verwaltet:
- **Projekte** — Stammdaten, Adressen, Alarm-Konfiguration, E-Mail-Empfänger
- **Devices** — Geräte mit Variablen, Limits, Alarm-Zustand
- **Monitors** — SPS-Monitoring-Definitionen mit Variablen und Bit-Mapping
- **Meldungstexte** — Siemens HMI Bitmeldungen mit SPS-Adress-Mapping
- **Zeitreihendaten** — Messwerte aus SPS-Polling mit Bit-Dekodierung
- **Lookup-Werte** — Basis für Dropdown-Listen

Der Datenaustausch erfolgt über:
- REST-API (interne UI)
- CSV-Import / CSV-Export
- SPS-Interface-Dateien (Siemens HMI JSON-Format)
- Messwerte-Import (SPS JSON → Zeitreihen-Datenbank)

---

## 2. Technologiestack

| Bereich | Technologie | Version |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.x |
| Runtime | Bun | aktuell |
| Sprache | TypeScript | 5.x (strict) |
| Styling | TailwindCSS | 4.x |
| Datenbank | SQLite (`better-sqlite3`) | 12.x |
| Authentifizierung | better-auth (inkl. Admin Plugin) | 1.6.x |
| Git-Remote | https://github.com/haraldgit1/ella_mdm1.git | — |

---

## 3. Fachliches Datenmodell

### 3.1 Stammdaten-Objekte

**Projekt** (`mdm_project`)
- Übergeordnete Einheit für alle anderen Objekte
- Enthält: Stammdaten, Adresse, Alarm-Konfiguration (Intervall, Count-Limit)
- PK: `project_name`

**Device** (`mdm_device`)
- Gehört immer genau zu einem Projekt
- Enthält: Geräte-Typ (Lookup 100), Status, Limits, Alarm-Zustand, technische JSON-Daten
- PK: `project_name + device_name`

**Device-Variable** (`mdm_device_variable`)
- SPS-Variable eines Devices (Datentyp, Offset, Einheit, Wertebereich)
- PK: `project_name + device_name + name`

**Monitor** (`mdm_monitor`)
- SPS-Monitor-Definition pro Projekt
- Enthält: Typ (Lookup 400: Meldung/Störung), Datenbaustein
- PK: `project_name + monitor_name`
- Monitor-Name kann umbenannt werden (ON UPDATE CASCADE auf Variablen)

**Monitor-Variable** (`mdm_monitor_variable`)
- SPS-Variable innerhalb eines Monitors
- Enthält: Datenbaustein, Datentyp, Offset, `value_id` (stabiler Surrogate Key)
- PK: `project_name + monitor_name + name`
- `value_id`: kommt aus `seq_monitor_variable`, bleibt unveränderlich auch bei Monitor-Umbenennung

**Meldungstext** (`mdm_message_text`)
- Siemens HMI Bitmeldung mit SPS-Adress-Mapping
- Enthält: Meldetext, Klasse (Lookup 500), Trigger-Tag/-Bit/-Adresse, HMI-Quittierung, Report-Flag
- PK: `project_name + message_name`
- `id`: projektspezifische Laufnummer (nicht global AUTOINCREMENT)

**Alarmstufe** (`mdm_project_alarm`)
- Projektbezogene Alarm-Konfiguration
- PK: `project_name + alarm_level_code`

**E-Mail-Adresse** (`mdm_project_email`)
- Ziel-Adressen für Alarm-Benachrichtigungen
- PK: `project_name + email_address`

**Lookup** (`mdm_lookup`)
- Basis für alle Dropdowns, gruppiert nach `function_code`
- PK: `function_code + code`

### 3.2 Zeitreihen-Objekte

**Messwert** (`ts_monitor_value`)
- Zeitreiheneintrag: ein Wert pro SPS-Variable pro Polling-Zyklus
- Felder: `ts` (Zeitstempel), `value_id` (FK auf Sequenz), `value` (REAL), `bit_value` (TEXT)
- PK: `id` (AUTOINCREMENT)
- Kein Soft Delete — Zeitreihendaten werden physisch gespeichert

**Bit-Adresse** (`ts_monitor_value_address`)
- Detail-Datensatz: ein Eintrag pro gesetztem Bit in `bit_value`
- Felder: `pos` (1,2,3,…), `trigger_bit` (0–15), `trigger_address`
- PK: `id + pos` (id = FK auf `ts_monitor_value`, ON DELETE CASCADE)

**Sequenz** (`seq_monitor_variable`)
- Erzeugt surrogate `value_id` für `mdm_monitor_variable`
- Nur INSERT, niemals DELETE

### 3.3 Audit-Felder

Alle MDM-Stammdatentabellen enthalten:

| Feld | Beschreibung |
|---|---|
| `create_user` | Ersteller (E-Mail) |
| `create_timestamp` | Erstellzeitpunkt |
| `modify_user` | Letzter Bearbeiter |
| `modify_timestamp` | Letzter Änderungszeitpunkt |
| `modify_status` | `inserted` \| `updated` \| `locked` \| `deleted` |
| `version` | Versionszähler (beginnt bei 1) |

Audit-Felder werden in der Applikation gesetzt (`src/lib/audit/audit.ts`), nicht per DB-Trigger.

### 3.4 Soft Delete

Datensätze werden **niemals physisch gelöscht**.
Löschen = `modify_status = 'deleted'`. Alle Abfragen filtern `WHERE modify_status != 'deleted'`.

---

## 4. SPS-Integration

### 4.1 SPS-Interface-Datei generieren

Erzeugt eine `.html`-Datei im Verzeichnis `data/` im Siemens HMI JSON-Format.
Die Datei wird in die Siemens SPS (TIA Portal HMI) importiert.

**Dateiformat:**
```
{
  "MonitorName" {
    "VarName1": :="MonitorName".VarName1:,
    "VarName2": :="MonitorName".VarName2:,
    ...
  }
}
```

**API-Endpunkte:**
| Endpunkt | Beschreibung | Ausgabedatei |
|---|---|---|
| `POST /api/sps-interface` | Interface für Device | `data/<DeviceName>.html` |
| `POST /api/monitor-interface` | Interface für Monitor | `data/<MonitorName>.html` |

### 4.2 Messwerte importieren (ts-import)

**Endpunkt:** `POST /api/ts-import` (multipart/form-data)

**Parameter:**
| Parameter | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `file` | File | ja | SPS JSON-Datei |
| `project_name` | string | ja | Projektname |
| `monitor_name` | string | ja | Monitorname |
| `ts` | string | nein | Zeitstempel ISO 8601 (default: jetzt) |

**SPS JSON-Format (Siemens):**
Das Siemens-Format verwendet Objektschlüssel ohne Doppelpunkt. Die ts-import-Route korrigiert
dies automatisch vor dem JSON-Parsen:
```
"MonitorName" {
  "VarName1": 7,
  "VarName2": 160
}
```
wird zu:
```json
{
  "MonitorName": {
    "VarName1": 7,
    "VarName2": 160
  }
}
```

**Verarbeitungslogik:**
1. JSON parsen (inkl. SPS-Format-Korrektur)
2. Äußeren Schlüssel (MonitorName) erkennen und auflösen → innere Variablen-Map
3. Pro Variable: `value_id`, `datablock`, `offset` aus `mdm_monitor_variable` nachschlagen
4. Numerischen Wert in `ts_monitor_value` einfügen (inkl. `bit_value`)
5. Wenn `bit_value != null`: Bit-Adressen in `ts_monitor_value_address` einfügen
6. Alle Inserts laufen in einer Transaktion (atomisch)

**Rückgabe:** `{ imported, skipped, ts }`

### 4.3 bit_value — Berechnung

`bit_value` ist die 16-stellige binäre Darstellung des ganzzahlig gerundeten Messwerts:

| Eingabe | Ergebnis |
|---|---|
| `null` | `null` |
| `0` | `null` |
| `< 0` (negativ) | `null` |
| `7` | `"0000000000000111"` |
| `160` | `"0000000010100000"` |
| `7.8` | `Math.round → 8 → "0000000000001000"` |

Formel: `Math.round(value).toString(2).padStart(16, "0")`

### 4.4 ts_monitor_value_address — Bit-Mapping

Für jeden gesetzten Bit in `bit_value` wird ein Datensatz in `ts_monitor_value_address` angelegt.

**trigger_bit:**
- 0-basierter Index von **links** im 16-Zeichen-String
- Zeichen 0 (linkestes) = Bit 0, Zeichen 15 (rechtestes) = Bit 15
- Sortierung **aufsteigend**: `pos=1` = niedrigster (linkester gesetzter) Bit

**Byte-Aufteilung (16 Bit = Byte1 + Byte2):**

| Byte | trigger_bit | Offset-Anpassung | Bit-Anteil der Adresse |
|---|---|---|---|
| Byte1 | 0 – 7 | `offsetNum + 1` | `trigger_bit` |
| Byte2 | 8 – 15 | `offsetNum` (unverändert) | `trigger_bit − 8` |

**offsetBase:** offset-Spalte aus `mdm_monitor_variable`, letztes `.X` abgeschnitten
- `"DBX102.0"` → `"DBX102"` → Zahl = 102, Präfix = `"DBX"`
- `"104.0"` → `"104"` → Zahl = 104, Präfix = `""`

**trigger_address:** `%{datablock}.{offsetByte}.{bitInByte}`

**Vollständiges Beispiel:**

`bit_value = "0001100010111111"`, `datablock = "DB31"`, `offset = "DBX102.0"`

Gesetzte Bits (Index von links): 3, 4, 8, 10, 11, 12, 13, 14, 15

| pos | trigger_bit | Byte | trigger_address |
|-----|-------------|------|-----------------|
| 1 | 3 | Byte1 | `%DB31.DBX103.3` |
| 2 | 4 | Byte1 | `%DB31.DBX103.4` |
| 3 | 8 | Byte2 | `%DB31.DBX102.0` |
| 4 | 10 | Byte2 | `%DB31.DBX102.2` |
| 5 | 11 | Byte2 | `%DB31.DBX102.3` |
| 6 | 12 | Byte2 | `%DB31.DBX102.4` |
| 7 | 13 | Byte2 | `%DB31.DBX102.5` |
| 8 | 14 | Byte2 | `%DB31.DBX102.6` |
| 9 | 15 | Byte2 | `%DB31.DBX102.7` |

---

## 5. Meldungstexte

`mdm_message_text` speichert Siemens HMI Bitmeldungen mit vollständigem SPS-Adress-Mapping.

### 5.1 Datenfelder

| Feld | Typ | Beschreibung |
|---|---|---|
| `project_name` | TEXT PK | Projektname (FK auf mdm_project) |
| `message_name` | TEXT PK | Eindeutiger Name der Meldung |
| `id` | INTEGER | Laufnummer pro Projekt (1, 2, 3, …) |
| `message_text` | TEXT | Meldetext (Pflichtfeld) |
| `message_class` | TEXT | Meldeklasse (Lookup function_code = 500) |
| `trigger_tag` | TEXT | SPS-Tag, der die Meldung auslöst |
| `trigger_bit` | INTEGER | Bit im Tag (0–15) |
| `trigger_address` | TEXT | Vollständige SPS-Adresse |
| `hmi_acknowledgment_tag` | TEXT | Quittierungs-Tag |
| `hmi_acknowledgment_bit` | INTEGER | Quittierungs-Bit (0–15) |
| `hmi_acknowledgment_address` | TEXT | Vollständige Quittierungs-Adresse |
| `report` | INTEGER | 1 = wird in Reports berücksichtigt |

### 5.2 ID-Vergabe

Die `id` ist eine **projektspezifische** Laufnummer (kein globales AUTOINCREMENT):
```sql
SELECT COALESCE(MAX(id), 0) + 1
FROM mdm_message_text
WHERE project_name = ? AND modify_status != 'deleted'
```

### 5.3 API-Endpunkte

| Methode | URL | Beschreibung |
|---|---|---|
| GET | `/api/message-texts?project_name=&message_text=&...` | Suche |
| POST | `/api/message-texts` | Neuanlage |
| PUT | `/api/message-texts/:projectName/:messageName` | Ändern |
| DELETE | `/api/message-texts/:projectName/:messageName` | Soft Delete |

---

## 6. API-Endpunkte (Vollständige Übersicht)

Alle Endpunkte erfordern aktive Session (better-auth Cookie). Nicht authentifizierte Requests → 401.

### Projekte
| Methode | URL | Beschreibung |
|---|---|---|
| GET/POST | `/api/projects` | Suche / Neuanlage |
| GET/PUT/DELETE | `/api/projects/:projectName` | Einzel / Ändern (inkl. lock/unlock) / Soft Delete |
| POST | `/api/projects/:projectName/send-test-email` | Test-E-Mail senden |

### Devices
| Methode | URL | Beschreibung |
|---|---|---|
| GET/POST | `/api/devices` | Suche / Neuanlage |
| GET/PUT/DELETE | `/api/devices/:projectName/:deviceName` | Einzel / Ändern (inkl. lock/unlock) / Soft Delete |
| GET/POST | `/api/variables` | Device-Variablen suchen / anlegen |
| PUT/DELETE | `/api/variables/:projectName/:deviceName/:name` | Variable ändern / löschen |
| POST | `/api/sps-interface` | SPS-Interface-Datei generieren |

### Monitors
| Methode | URL | Beschreibung |
|---|---|---|
| GET/POST | `/api/monitors` | Suche / Neuanlage |
| GET/PUT/DELETE | `/api/monitors/:projectName/:monitorName` | Einzel / Ändern (inkl. Umbenennen) / Soft Delete |
| GET/POST | `/api/monitor-variables` | Monitor-Variablen suchen / anlegen |
| PUT/DELETE | `/api/monitor-variables/:projectName/:monitorName/:name` | Variable ändern / löschen |
| POST | `/api/monitor-interface` | SPS-Interface-Datei generieren |
| POST | `/api/ts-import` | Messwerte (SPS JSON) importieren |

### Meldungstexte
| Methode | URL | Beschreibung |
|---|---|---|
| GET/POST | `/api/message-texts` | Suche / Neuanlage |
| PUT/DELETE | `/api/message-texts/:projectName/:messageName` | Ändern / Soft Delete |

### Stammdaten
| Methode | URL | Beschreibung |
|---|---|---|
| GET/POST | `/api/alarms` | Alarmstufen suchen / anlegen |
| PUT/DELETE | `/api/alarms/:projectName/:alarmLevelCode` | Ändern / Soft Delete |
| GET/POST | `/api/emails` | E-Mail-Adressen suchen / anlegen |
| DELETE | `/api/emails/:projectName/:emailAddress` | Soft Delete |
| GET | `/api/lookups?function=<code>` | Lookup-Werte nach function_code |
| PUT/DELETE | `/api/lookups/:functionCode/:code` | Lookup ändern / löschen |

### Import / Export
| Methode | URL | Beschreibung |
|---|---|---|
| POST | `/api/import` | CSV-Upload (multipart, charset-Parameter) |
| GET | `/api/export` | CSV-Download |

---

## 7. GUI-Konzept

### 7.1 Routen

| Route | Seite |
|---|---|
| `/` | Redirect → `/login` |
| `/login` | Login |
| `/signup` | Registrierung |
| `/dashboard` | Startseite (2-Ebenen, 5 Sektionen) |
| `/projects` | Projekte: Suche + Ergebnisliste |
| `/projects/:projectName` | Projekt-Detail (Tabs: Allgemein, Adresse, Technik, Alarmstufen, E-Mails) |
| `/devices` | Devices: Suche + Ergebnisliste |
| `/devices/:projectName/:deviceName` | Device-Detail (Tabs: Allgemein, Beschreibung, Limits, Alarm, Technik, Variablen) |
| `/monitors` | Monitors: Suche + Ergebnisliste |
| `/monitors/:projectName?monitor=name` | Monitor-Detail (Tabs: Allgemein, Beschreibung, Technik, Variablen) |
| `/alarms` | Alarmstufen: Suche + Liste + Dialog |
| `/message-texts` | Meldungstexte: Suche + Liste + Dialog |
| `/import` | CSV-Import |
| `/export` | CSV-Export |
| `/reports` | Reports (Platzhalter) |
| `/users` | Benutzerverwaltung (nur Admins) |

### 7.2 3-Dialog-Prinzip

Jeder Hauptbereich folgt dem Ablauf:
1. **Suchmaske** — Eingabefelder + Button "Suche"
2. **Ergebnisliste** — Tabelle, klickbare Zeilen; zuletzt geöffnete Zeile bleibt hervorgehoben (blau)
3. **Detailseite / Dialog** — Formular mit Tabs (komplex) oder Modal-Dialog (einfach)

### 7.3 Navigation: Zurück zur Ergebnisliste

- Suchparameter werden in der URL gespeichert (z.B. `/projects?project_name=WIND&searched=1`)
- Beim Mount: URL-Parameter triggern automatische Suche
- Zuletzt geöffnete Zeile: `sessionStorage` → `scrollIntoView()` + `bg-blue-100`/`font-bold`

### 7.4 Dashboard

Zwei Ebenen mit Sektionen:

| Sektion | Kacheln |
|---|---|
| Stammdaten | Projekte, Devices, Monitors, Variablen, Meldungstexte, Lookups |
| Monitoring | Events, Rules, Actions (geplant) |
| Import / Export | CSV-Import, CSV-Export |
| Berichte | Reports |
| Administration | Benutzer |

### 7.5 Aktionsbuttons (Detailmasken)

| Button | Farbe | Sichtbar |
|---|---|---|
| Abbrechen | grau | immer |
| Freigabe | grün | nur wenn modify_status = 'locked' |
| Sperren | gelb | nur wenn nicht gesperrt |
| Löschen | rot | nur bei bestehenden Datensätzen |
| Kopieren | grau | bei bestehenden Datensätzen (wo implementiert) |
| Speichern | blau | immer |

Alle Buttons sind auch bei gesperrten Datensätzen sichtbar und nutzbar.

### 7.6 Monitor-URL-Muster

Monitor-Detailseite verwendet Query-Parameter statt URL-Segment, da Monitor-Namen Leerzeichen enthalten:
`/monitors/[projectName]?monitor=monitorName`

---

## 8. CSV-Import

**Endpunkt:** `POST /api/import` (multipart/form-data)

**Konfiguration:**
| Parameter | Werte | Default |
|---|---|---|
| `type` | siehe Tabelle unten | — |
| `charset` | `utf-8`, `windows-1252`, `iso-8859-1` | `utf-8` |
| `file` | CSV-Datei | — |

Separator wird automatisch erkannt (`;` vs `,` nach Häufigkeit in der Header-Zeile).
Import-Protokoll in `mdm_import_log` (Status: running → success / warning / error).

**Import-Typen:**

| Typ | Tabelle | Schlüssel | Logik |
|---|---|---|---|
| `projects` | `mdm_project` | `project_name` | INSERT oder UPDATE |
| `devices` | `mdm_device` | `project_name + device_name` | INSERT oder UPDATE |
| `alarms` | `mdm_project_alarm` | `project_name + alarm_level_code` | INSERT oder UPDATE |
| `emails` | `mdm_project_email` | `project_name + email_address` | INSERT oder UPDATE |
| `lookups` | `mdm_lookup` | `function_code + code` | INSERT oder UPDATE |
| `variables` | `mdm_device_variable` | `project_name + device_name + name` | INSERT oder UPDATE |
| `monitor_variables` | `mdm_monitor_variable` | `project_name + monitor_name + name` | INSERT oder UPDATE |
| `message_texts` | `mdm_message_text` | `project_name + message_name` | INSERT (id=MAX+1) oder UPDATE |

---

## 9. Authentifizierung & Benutzerverwaltung

- better-auth mit Email/Password
- Alle API-Routen und Seiten erfordern aktive Session → nicht authentifiziert → 401 / Redirect `/login`
- Admin Plugin: Rollenverwaltung (`role`), Sperren (`banned`, `banReason`, `banExpires`), Session-Impersonation
- Benutzerverwaltung unter `/users` — nur für Admins zugänglich
- Funktionen: Liste, Neuanlage, Bearbeiten, Sperren/Entsperren, Passwort setzen

---

## 10. Datenbankschema — Überblick

Das vollständige DDL liegt in `src/lib/db/schema.sql`.
Wird beim ersten `getDb()`-Aufruf automatisch eingespielt.
Migrations-Logik in `src/lib/db/db.ts`.

### Tabellen-Übersicht

| Kategorie | Tabelle | Primärschlüssel |
|---|---|---|
| Stammdaten | `mdm_project` | `project_name` |
| | `mdm_device` | `project_name + device_name` |
| | `mdm_device_variable` | `project_name + device_name + name` |
| | `mdm_project_alarm` | `project_name + alarm_level_code` |
| | `mdm_project_email` | `project_name + email_address` |
| | `mdm_monitor` | `project_name + monitor_name` |
| | `mdm_monitor_variable` | `project_name + monitor_name + name` |
| | `mdm_message_text` | `project_name + message_name` |
| | `mdm_lookup` | `function_code + code` |
| Zeitreihen | `seq_monitor_variable` | `value_id` (AUTOINCREMENT) |
| | `ts_monitor_value` | `id` (AUTOINCREMENT) |
| | `ts_monitor_value_address` | `id + pos` |
| Protokoll | `mdm_import_log` | `import_id` |
| | `mdm_sync_log` | `sync_id` |
| Auth | `user`, `session`, `account`, `verification` | — |

### Lookup-Codes

| function_code | Bedeutung | Beispielwerte |
|---|---|---|
| 100 | DeviceType | Sensor, Motor, Pumpe, Ventil, Regler |
| 200 | ProjectType | Kraftwerk, Anlage, Gebäude, Infrastruktur |
| 300 | DataType | Variablen-Datentypen |
| 400 | MonitorType | 1=Meldung, 2=Störung |
| 500 | AlarmClass | Acknowledgement, Betriebsmeldungen, Errors, No Acknowledgement, Warnings |

---

## 11. Implementierungsstand (Stand 2026-05-02)

| Bereich | Status | Anmerkung |
|---|---|---|
| Login / Signup | ✅ fertig | better-auth, Email+Password |
| Dashboard | ✅ fertig | 2-Ebenen, 5 Sektionen |
| Projekte CRUD | ✅ fertig | inkl. Kopieren, Sperren/Freigabe, Test-E-Mail |
| Devices CRUD | ✅ fertig | inkl. Variablen, Sperren/Freigabe, SPS-Interface |
| Monitors CRUD | ✅ fertig | inkl. Variablen (inline-edit), Umbenennen, SPS-Interface |
| Alarme CRUD | ✅ fertig | standalone + im Projekt-Tab |
| E-Mails CRUD | ✅ fertig | im Projekt-Tab |
| Meldungstexte CRUD | ✅ fertig | Suche, Liste, Dialog (Neu/Bearbeiten/Löschen), CSV-Import |
| CSV-Import | ✅ fertig | 8 Typen, Encoding-Auswahl, auto-detect Separator |
| CSV-Export | ✅ fertig | CSV-Download |
| Benutzerverwaltung | ✅ fertig | Liste, Neu, Bearbeiten, Sperren, Passwort setzen (nur Admins) |
| Messwerte-Import (ts-import) | ✅ fertig | SPS JSON → ts_monitor_value + ts_monitor_value_address |
| Reports | 🔲 offen | Nur Platzhalter-Seite |
| Lookup-Verwaltung UI | 🔲 offen | Nur Seed-Daten, keine UI |
| Messwert-Anzeige | 🔲 offen | Zeitreihen-Darstellung in Monitor-Detailseite |
| Cloud-Sync REST | 🔲 offen | Noch nicht implementiert |

---

## 12. Offene Punkte / Nächste Version

1. **Reports-Seite** — aktive Projekte, Devices mit Alarm, Messwert-Auswertungen, Bit-Meldungs-Statistiken
2. **Lookup-Verwaltung** — UI zum Pflegen von `mdm_lookup` (DeviceType, ProjectType, AlarmClass, …)
3. **Messwert-Anzeige** — Zeitreihen-Darstellung in der Monitor-Detailseite, Bit-Meldungs-Tabelle mit Meldungstext-Mapping
4. **Event Rules / Events / Actions** — Monitoring-Unterbereich (Dashboard-Sektion geplant)
5. **Cloud-Sync** — REST-API-Anbindung an Ella-Energy (AWS), Nutzung von `mdm_sync_log`
