# 📘 Ella Edge Integration Hub – Technische Spezifikation

## 1. Überblick

Der **Ella Edge Integration Hub** ist eine lokale Edge-Applikation zur Verwaltung, Überwachung und Integration von technischen Anlagen (z. B. Kraftwerke, Wehranlagen, industrielle Systeme).

Die Applikation erfüllt drei zentrale Aufgaben:

- **Lokales Anlagenmodell (MDM)**
- **Ereigniserkennung & Monitoring**
- **Integration & Synchronisation mit der Ella-Plattform (Cloud)**

---

## 2. Betriebsmodi

Der Ella Edge Integration Hub unterstützt zwei Betriebsmodi:

### 🔹 Standalone-Modus
- Betrieb vollständig lokal
- Keine Verbindung zur Cloud erforderlich
- Nutzung für:
  - Monitoring
  - Alarmierung
  - Reporting

### 🔹 Verbundmodus (Integration & Sync aktiv)
- Synchronisation mit der Ella-Plattform (AWS)
- Übertragung von:
  - IST-Werten (Zeitreihen)
  - Events / Meldungen
  - ausgewählten Stammdaten
- Empfang von:
  - Forecast-Daten (TiRex)
  - Sollwerten / Empfehlungen (optional)

---

## 3. Gesamtarchitektur (fachlich)

[ Siemens SPS / Devices ]
            ↓
     Variablen (IST-Werte)
            ↓
     Event Rules Engine
            ↓
          Events
            ↓
     Actions / Messages
            ↓
   Integration & Sync Layer
            ↓
   Ella Cloud Plattform (AWS)

---

## 4. Modulstruktur der Applikation

## 4.1 Stammdaten (MDM)

Verwaltung der statischen Struktur der Anlage.

### Entitäten:

- **Projekte**
- **Devices**
- **Variablen**
- **Lookups**

---

## 4.2 Monitoring

Erkennung und Verarbeitung von Ereignissen.

### Komponenten:

#### Event Rules
- Definition von Bedingungen

#### Events
- Tatsächlich erkannte Ereignisse

#### Actions / Messages
- Reaktion auf Events

---

## 4.3 Integration & Sync

Zentrale Schnittstelle zur Ella Cloud Plattform.

### 4.3.1 Sync-Konfiguration
- Zuordnung Projekt ↔ Cloud-Projekt
- Sync-Intervalle

### 4.3.2 Datenmapping
- Variable → Cloud-Serie
- Einheiten

### 4.3.3 Export Queue
- Messwerte
- Events
- Statusmeldungen

### 4.3.4 Import Queue
- Forecast-Daten
- Sollwerte

### 4.3.5 Sync-Historie
- Zeitpunkt
- Erfolg / Fehler

### 4.3.6 Verbindungsstatus
- Online / Offline
- Queue-Längen

---

## 4.4 Reports

- Betriebsberichte
- Monatsberichte
- Event-Auswertungen

---

## 4.5 Administration

- Kommunikationskanäle
- Benutzer & Rollen
- Logging & Diagnose

---

## 5. Datenkategorien

### Stammdaten
- Projekte
- Devices
- Variablen
- Lookups

### Bewegungsdaten
- IST-Werte
- Events
- Zustände

---

## 6. Beziehung zwischen Events und Integration

- Events = Was ist passiert?
- Actions = Was wird ausgelöst?
- Integration = Was wird übertragen?

---

## 7. Technischer Zusatzhinweis

### Architekturprinzip: Queue-basierte Integration

Empfohlen:
- sync_outbox
- sync_inbox
- Status: pending, sent, error

Vorteile:
- Fehlertoleranz
- Nachvollziehbarkeit

---

## 8. Zielbild

Der Ella Edge Integration Hub ist ein lokaler Integrationsknoten zur Verbindung von Anlagen und Ella Cloud.

---

## 9. Zusammenfassung

Kernbereiche:
1. Stammdaten
2. Monitoring
3. Integration & Sync
4. Reports
5. Administration
