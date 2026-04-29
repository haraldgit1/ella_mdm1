/**
 * Seed-Script: Testdaten für alle Bereiche + Test-Benutzer "herbert1"
 * Ausführen mit: bunx tsx src/lib/db/seed-testdata.ts
 */

process.env.BETTER_AUTH_URL = "http://localhost:3000";

import { auth } from "../auth/auth";
import { getDb } from "./db";

async function main() {
const db = getDb();
const NOW = new Date().toISOString().replace("T", " ").slice(0, 19);
const USER = "herbert1@test.local";

// ─── 1. Test-Benutzer anlegen ────────────────────────────────────────────────
console.log("1. Test-Benutzer anlegen…");
try {
  await auth.api.signUpEmail({
    body: { name: "Herbert1", email: USER, password: "Herbert1!" },
  });
  console.log(`   ✓ Benutzer ${USER} angelegt`);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("already")) {
    console.log(`   — Benutzer ${USER} existiert bereits`);
  } else {
    console.log(`   — Fehler: ${msg}`);
  }
}
// Admin-Rolle setzen (Spalte ggf. erst anlegen)
try {
  const userCols = db.prepare("PRAGMA table_info(user)").all() as { name: string }[];
  if (!userCols.some((c) => c.name === "role")) {
    db.exec("ALTER TABLE user ADD COLUMN role TEXT");
  }
  if (!userCols.some((c) => c.name === "banned")) {
    db.exec("ALTER TABLE user ADD COLUMN banned INTEGER DEFAULT 0");
    db.exec("ALTER TABLE user ADD COLUMN banReason TEXT");
    db.exec("ALTER TABLE user ADD COLUMN banExpires DATETIME");
  }
  db.prepare("UPDATE user SET role = 'admin' WHERE email = ?").run(USER);
  console.log(`   ✓ Rolle 'admin' gesetzt`);
} catch (err) {
  console.log(`   — Fehler beim Setzen der Rolle: ${err}`);
}

// ─── 2. Lookup-Daten (INSERT OR IGNORE) ─────────────────────────────────────
console.log("2. Lookup-Daten…");
const lookups = [
  { function_code: 100, code: "1", description: "Sensor",         function_text: "DeviceType" },
  { function_code: 100, code: "2", description: "Motor",          function_text: "DeviceType" },
  { function_code: 100, code: "3", description: "Pumpe",          function_text: "DeviceType" },
  { function_code: 100, code: "4", description: "Ventil",         function_text: "DeviceType" },
  { function_code: 100, code: "5", description: "Regler",         function_text: "DeviceType" },
  { function_code: 200, code: "1", description: "Kraftwerk",      function_text: "ProjectType" },
  { function_code: 200, code: "2", description: "Anlage",         function_text: "ProjectType" },
  { function_code: 200, code: "3", description: "Gebäude",        function_text: "ProjectType" },
  { function_code: 200, code: "4", description: "Infrastruktur",  function_text: "ProjectType" },
  { function_code: 300, code: "1", description: "Bool",                  function_text: "DataType" },
  { function_code: 300, code: "2", description: "Int",                   function_text: "DataType" },
  { function_code: 300, code: "3", description: "Real",                  function_text: "DataType" },
  // AlarmClass (function_code = 500)
  { function_code: 500, code: "1", description: "Acknowledgement",       function_text: "AlarmClass" },
  { function_code: 500, code: "2", description: "Betriebsmeldungen",     function_text: "AlarmClass" },
  { function_code: 500, code: "3", description: "Errors",                function_text: "AlarmClass" },
  { function_code: 500, code: "4", description: "No Acknowledgement",    function_text: "AlarmClass" },
  { function_code: 500, code: "5", description: "Warnings",              function_text: "AlarmClass" },
];
const insLookup = db.prepare(
  `INSERT OR IGNORE INTO mdm_lookup
     (function_code, code, description, function_text, create_user, modify_user, modify_status)
   VALUES (@function_code, @code, @description, @function_text, @u, @u, 'inserted')`
);
db.transaction(() => lookups.forEach((r) => insLookup.run({ ...r, u: USER })))();
console.log(`   ✓ ${lookups.length} Lookup-Einträge`);

// ─── 3. Projekte ─────────────────────────────────────────────────────────────
console.log("3. Projekte…");
const projects = [
  {
    project_name: "WINDPARK-NORD",
    title: "Windpark Nordsee Alpha",
    short_description: "Offshore-Windpark mit 12 Anlagen an der Nordsee",
    project_type_code: "1",
    street: "Hafenstraße", house_no: "1", postal_code: "26506", city: "Norden", country: "DE",
    primary_ip_address: "10.0.1.1", secondary_ip_address: "10.0.1.2",
    alarm_interval_sec: 60, alarm_count_limit: 5,
  },
  {
    project_name: "SOLARPARK-SUED",
    title: "Solarpark Bayern Süd",
    short_description: "Freiflächen-Solaranlage 20 MWp",
    project_type_code: "2",
    street: "Sonnenweg", house_no: "12", postal_code: "83022", city: "Rosenheim", country: "DE",
    primary_ip_address: "10.0.2.1", secondary_ip_address: null,
    alarm_interval_sec: 120, alarm_count_limit: 3,
  },
  {
    project_name: "BIOMASSE-WEST",
    title: "Biomassekraftwerk Westfalen",
    short_description: "Biomasse-BHKW 5 MW elektrisch",
    project_type_code: "1",
    street: "Industriepark", house_no: "5", postal_code: "48143", city: "Münster", country: "DE",
    primary_ip_address: "10.0.3.1", secondary_ip_address: "10.0.3.2",
    alarm_interval_sec: 30, alarm_count_limit: 10,
  },
];

const insProject = db.prepare(
  `INSERT OR IGNORE INTO mdm_project
     (project_name, title, short_description, project_type_code,
      street, house_no, postal_code, city, country,
      primary_ip_address, secondary_ip_address,
      alarm_interval_sec, alarm_count_limit,
      create_user, create_timestamp, modify_user, modify_timestamp, modify_status)
   VALUES
     (@project_name, @title, @short_description, @project_type_code,
      @street, @house_no, @postal_code, @city, @country,
      @primary_ip_address, @secondary_ip_address,
      @alarm_interval_sec, @alarm_count_limit,
      @u, @ts, @u, @ts, 'inserted')`
);
db.transaction(() => projects.forEach((p) => insProject.run({ ...p, u: USER, ts: NOW })))();
console.log(`   ✓ ${projects.length} Projekte`);

// ─── 4. Alarmstufen pro Projekt ───────────────────────────────────────────────
console.log("4. Alarmstufen…");
const alarms = [
  // WINDPARK-NORD
  { project_name: "WINDPARK-NORD",  alarm_level_code: "KRIT",  alarm_text: "Kritischer Systemfehler – sofortiger Stopp",  severity_rank: 1 },
  { project_name: "WINDPARK-NORD",  alarm_level_code: "WARN",  alarm_text: "Warnung: Grenzwert überschritten",             severity_rank: 2 },
  { project_name: "WINDPARK-NORD",  alarm_level_code: "INFO",  alarm_text: "Information: Wartung fällig",                 severity_rank: 3 },
  // SOLARPARK-SUED
  { project_name: "SOLARPARK-SUED", alarm_level_code: "KRIT",  alarm_text: "Wechselrichter ausgefallen",                  severity_rank: 1 },
  { project_name: "SOLARPARK-SUED", alarm_level_code: "WARN",  alarm_text: "Ertrag unter Schwellwert",                    severity_rank: 2 },
  // BIOMASSE-WEST
  { project_name: "BIOMASSE-WEST", alarm_level_code: "KRIT",  alarm_text: "Notabschaltung ausgelöst",                    severity_rank: 1 },
  { project_name: "BIOMASSE-WEST", alarm_level_code: "WARN",  alarm_text: "Temperatur außerhalb Normbereich",            severity_rank: 2 },
  { project_name: "BIOMASSE-WEST", alarm_level_code: "INFO",  alarm_text: "Routinecheck erforderlich",                   severity_rank: 3 },
];

const insAlarm = db.prepare(
  `INSERT OR IGNORE INTO mdm_project_alarm
     (project_name, alarm_level_code, alarm_text, severity_rank,
      create_user, create_timestamp, modify_user, modify_timestamp, modify_status)
   VALUES
     (@project_name, @alarm_level_code, @alarm_text, @severity_rank,
      @u, @ts, @u, @ts, 'inserted')`
);
db.transaction(() => alarms.forEach((a) => insAlarm.run({ ...a, u: USER, ts: NOW })))();
console.log(`   ✓ ${alarms.length} Alarmstufen`);

// ─── 5. Ziel-E-Mail-Adressen ─────────────────────────────────────────────────
console.log("5. Ziel-E-Mails…");
const emails = [
  { project_name: "WINDPARK-NORD",  email_address: "noc@windpark-nord.de",      email_purpose: "Alarm",     is_active: 1 },
  { project_name: "WINDPARK-NORD",  email_address: "technik@windpark-nord.de",  email_purpose: "Wartung",   is_active: 1 },
  { project_name: "SOLARPARK-SUED", email_address: "alarm@solarpark-sued.de",   email_purpose: "Alarm",     is_active: 1 },
  { project_name: "SOLARPARK-SUED", email_address: "report@solarpark-sued.de",  email_purpose: "Report",    is_active: 0 },
  { project_name: "BIOMASSE-WEST", email_address: "betrieb@biomasse-west.de",  email_purpose: "Alarm",     is_active: 1 },
];

const insEmail = db.prepare(
  `INSERT OR IGNORE INTO mdm_project_email
     (project_name, email_address, email_purpose, is_active,
      create_user, create_timestamp, modify_user, modify_timestamp, modify_status)
   VALUES
     (@project_name, @email_address, @email_purpose, @is_active,
      @u, @ts, @u, @ts, 'inserted')`
);
db.transaction(() => emails.forEach((e) => insEmail.run({ ...e, u: USER, ts: NOW })))();
console.log(`   ✓ ${emails.length} E-Mail-Adressen`);

// ─── 6. Devices ──────────────────────────────────────────────────────────────
console.log("6. Devices…");
const devices = [
  // WINDPARK-NORD
  { project_name: "WINDPARK-NORD",  device_name: "WEA-01",    title: "Windenergie­anlage 1",   device_type_code: "2", status: "active",   limit_min_value: 0,   limit_max_value: 2500, alarm_enabled: 0, alarm_level_code: null },
  { project_name: "WINDPARK-NORD",  device_name: "WEA-02",    title: "Windenergie­anlage 2",   device_type_code: "2", status: "active",   limit_min_value: 0,   limit_max_value: 2500, alarm_enabled: 1, alarm_level_code: "WARN" },
  { project_name: "WINDPARK-NORD",  device_name: "SENSOR-T1", title: "Temperatursensor Turm 1", device_type_code: "1", status: "active",   limit_min_value: -20, limit_max_value: 60,   alarm_enabled: 0, alarm_level_code: null },
  { project_name: "WINDPARK-NORD",  device_name: "PUMPE-01",  title: "Kühlmittelpumpe",        device_type_code: "3", status: "inactive", limit_min_value: null, limit_max_value: null, alarm_enabled: 0, alarm_level_code: null },

  // SOLARPARK-SUED
  { project_name: "SOLARPARK-SUED", device_name: "INV-01",    title: "Wechselrichter 1",       device_type_code: "5", status: "active",   limit_min_value: 0,   limit_max_value: 5000, alarm_enabled: 0, alarm_level_code: null },
  { project_name: "SOLARPARK-SUED", device_name: "INV-02",    title: "Wechselrichter 2",       device_type_code: "5", status: "active",   limit_min_value: 0,   limit_max_value: 5000, alarm_enabled: 1, alarm_level_code: "KRIT" },
  { project_name: "SOLARPARK-SUED", device_name: "SENSOR-S1", title: "Strahlungssensor",       device_type_code: "1", status: "active",   limit_min_value: 0,   limit_max_value: 1200, alarm_enabled: 0, alarm_level_code: null },

  // BIOMASSE-WEST
  { project_name: "BIOMASSE-WEST", device_name: "KESSEL-01", title: "Dampfkessel 1",          device_type_code: "2", status: "active",   limit_min_value: 50,  limit_max_value: 180,  alarm_enabled: 0, alarm_level_code: null },
  { project_name: "BIOMASSE-WEST", device_name: "VENTIL-01", title: "Hauptabsperrventil",     device_type_code: "4", status: "active",   limit_min_value: null, limit_max_value: null, alarm_enabled: 0, alarm_level_code: null },
  { project_name: "BIOMASSE-WEST", device_name: "PUMPE-01",  title: "Speisewasserpumpe",      device_type_code: "3", status: "active",   limit_min_value: 0,   limit_max_value: 100,  alarm_enabled: 1, alarm_level_code: "WARN" },
];

const insDevice = db.prepare(
  `INSERT OR IGNORE INTO mdm_device
     (project_name, device_name, title, device_type_code, status,
      limit_min_value, limit_max_value, alarm_enabled, alarm_level_code,
      create_user, create_timestamp, modify_user, modify_timestamp, modify_status)
   VALUES
     (@project_name, @device_name, @title, @device_type_code, @status,
      @limit_min_value, @limit_max_value, @alarm_enabled, @alarm_level_code,
      @u, @ts, @u, @ts, 'inserted')`
);
db.transaction(() => devices.forEach((d) => insDevice.run({ ...d, u: USER, ts: NOW })))();
console.log(`   ✓ ${devices.length} Devices`);

// ─── 7. Device-Variablen ─────────────────────────────────────────────────────
console.log("7. Device-Variablen…");
const variables = [
  { project_name: "WINDPARK-NORD",  device_name: "WEA-01",    name: "Leistung",      title: "Aktuelle Leistung",       datablock: "DB10", data_type: "3", offset: "DB10.DBD0",  range: "0..2500",  unit: "kW",  detail_json: null },
  { project_name: "WINDPARK-NORD",  device_name: "WEA-01",    name: "Drehzahl",      title: "Rotordrehzahl",           datablock: "DB10", data_type: "3", offset: "DB10.DBD4",  range: "0..20",    unit: "rpm", detail_json: null },
  { project_name: "WINDPARK-NORD",  device_name: "WEA-01",    name: "Betrieb",       title: "Betriebszustand",         datablock: "DB10", data_type: "1", offset: "DB10.DBX0.0",range: null,       unit: null,  detail_json: null },
  { project_name: "WINDPARK-NORD",  device_name: "SENSOR-T1", name: "Temperatur",    title: "Turmtemperatur",          datablock: "DB20", data_type: "3", offset: "DB20.DBD0",  range: "-20..60",  unit: "°C",  detail_json: null },
  { project_name: "SOLARPARK-SUED", device_name: "INV-01",    name: "DC-Spannung",   title: "DC-Eingangsspannung",     datablock: "DB30", data_type: "3", offset: "DB30.DBD0",  range: "0..1000",  unit: "V",   detail_json: null },
  { project_name: "SOLARPARK-SUED", device_name: "INV-01",    name: "AC-Leistung",   title: "AC-Ausgangsleistung",     datablock: "DB30", data_type: "3", offset: "DB30.DBD4",  range: "0..5000",  unit: "W",   detail_json: null },
  { project_name: "BIOMASSE-WEST",  device_name: "KESSEL-01", name: "Druck",         title: "Kesseldruck",             datablock: "DB40", data_type: "3", offset: "DB40.DBD0",  range: "0..16",    unit: "bar", detail_json: null },
  { project_name: "BIOMASSE-WEST",  device_name: "KESSEL-01", name: "Temperatur",    title: "Kesseltemperatur",        datablock: "DB40", data_type: "3", offset: "DB40.DBD4",  range: "50..180",  unit: "°C",  detail_json: null },
  { project_name: "BIOMASSE-WEST",  device_name: "KESSEL-01", name: "Freigabe",      title: "Brenner-Freigabe",        datablock: "DB40", data_type: "1", offset: "DB40.DBX0.0",range: null,       unit: null,  detail_json: null },
];
const insVariable = db.prepare(
  `INSERT OR IGNORE INTO mdm_device_variable
     (project_name, device_name, name, title, datablock, data_type, offset, range, unit, detail_json,
      create_user, create_timestamp, modify_user, modify_timestamp, modify_status)
   VALUES
     (@project_name, @device_name, @name, @title, @datablock, @data_type, @offset, @range, @unit, @detail_json,
      @u, @ts, @u, @ts, 'inserted')`
);
db.transaction(() => variables.forEach((v) => insVariable.run({ ...v, u: USER, ts: NOW })))();
console.log(`   ✓ ${variables.length} Variablen`);

// ─── 8. Import-Log (Beispieleintrag) ─────────────────────────────────────────
console.log("7. Import-Log…");
db.prepare(
  `INSERT OR IGNORE INTO mdm_import_log
     (import_id, import_type, source_filename, started_at, finished_at,
      imported_by, status, message, result_json)
   VALUES
     ('SEED-001', 'project', 'testdata_seed.csv', @ts, @ts,
      @u, 'success', 'Seed-Import erfolgreich',
      '{"inserted":3,"updated":0,"errors":0}')`
).run({ ts: NOW, u: USER });
console.log("   ✓ 1 Import-Log-Eintrag");

// ─── 8. Sync-Log (Beispieleintrag) ───────────────────────────────────────────
console.log("8. Sync-Log…");
db.prepare(
  `INSERT OR IGNORE INTO mdm_sync_log
     (sync_id, sync_direction, entity_name, entity_key,
      sync_timestamp, status, message)
   VALUES
     ('SYNC-001', 'outbound', 'mdm_project', 'WINDPARK-NORD',
      @ts, 'success', 'Initiale Synchronisierung')`
).run({ ts: NOW });
console.log("   ✓ 1 Sync-Log-Eintrag");

// ─── 9. Meldungstexte (Bit-Mapping) ──────────────────────────────────────────
console.log("9. Meldungstexte…");
db.exec("DELETE FROM mdm_message_text");
const messageTexts = [
  // WINDPARK-NORD — WEA Bitmeldungen
  { name: "WEA_Bitmeldung_01", alarm_text: "F 01 Not-Halt Auslösung",            alarm_class: "Errors",            trigger_tag: "HMI Bereichszeiger.WEA_HMI_16_01", trigger_bit: 0, trigger_address: "%DB31.DBX100.0", hmi_acknowledgment_tag: "HMI Fehler Quitt WEA_HMI_16_01", hmi_acknowledgment_bit: 0, hmi_acknowledgment_address: "%DB31.DBX403.0", report: 1 },
  { name: "WEA_Bitmeldung_02", alarm_text: "F 02 Not-Halt Schütz Auslösung",     alarm_class: "Errors",            trigger_tag: "HMI Bereichszeiger.WEA_HMI_16_01", trigger_bit: 1, trigger_address: "%DB31.DBX100.1", hmi_acknowledgment_tag: "HMI Fehler Quitt WEA_HMI_16_01", hmi_acknowledgment_bit: 1, hmi_acknowledgment_address: "%DB31.DBX403.1", report: 1 },
  { name: "WEA_Bitmeldung_03", alarm_text: "W 03 Übertemperatur Getriebe",       alarm_class: "Warnings",          trigger_tag: "HMI Bereichszeiger.WEA_HMI_16_01", trigger_bit: 2, trigger_address: "%DB31.DBX100.2", hmi_acknowledgment_tag: "HMI Fehler Quitt WEA_HMI_16_01", hmi_acknowledgment_bit: 2, hmi_acknowledgment_address: "%DB31.DBX403.2", report: 1 },
  { name: "WEA_Bitmeldung_04", alarm_text: "W 04 Übertemperatur Generator",      alarm_class: "Warnings",          trigger_tag: "HMI Bereichszeiger.WEA_HMI_16_01", trigger_bit: 3, trigger_address: "%DB31.DBX100.3", hmi_acknowledgment_tag: "HMI Fehler Quitt WEA_HMI_16_01", hmi_acknowledgment_bit: 3, hmi_acknowledgment_address: "%DB31.DBX403.3", report: 1 },
  { name: "WEA_Bitmeldung_05", alarm_text: "B 05 Wartungsmodus aktiv",           alarm_class: "Betriebsmeldungen", trigger_tag: "HMI Bereichszeiger.WEA_HMI_16_01", trigger_bit: 4, trigger_address: "%DB31.DBX100.4", hmi_acknowledgment_tag: null,                              hmi_acknowledgment_bit: null, hmi_acknowledgment_address: null,              report: 0 },
  { name: "WEA_Bitmeldung_06", alarm_text: "B 06 Anlage in Betrieb",             alarm_class: "Betriebsmeldungen", trigger_tag: "HMI Bereichszeiger.WEA_HMI_16_01", trigger_bit: 5, trigger_address: "%DB31.DBX100.5", hmi_acknowledgment_tag: null,                              hmi_acknowledgment_bit: null, hmi_acknowledgment_address: null,              report: 0 },
  { name: "WEA_Bitmeldung_07", alarm_text: "F 07 Überdrehzahl Rotor",            alarm_class: "Errors",            trigger_tag: "HMI Bereichszeiger.WEA_HMI_16_01", trigger_bit: 6, trigger_address: "%DB31.DBX100.6", hmi_acknowledgment_tag: "HMI Fehler Quitt WEA_HMI_16_01", hmi_acknowledgment_bit: 6, hmi_acknowledgment_address: "%DB31.DBX403.6", report: 1 },
  { name: "WEA_Bitmeldung_08", alarm_text: "A 08 Windgeschwindigkeit zu hoch",   alarm_class: "Acknowledgement",   trigger_tag: "HMI Bereichszeiger.WEA_HMI_16_01", trigger_bit: 7, trigger_address: "%DB31.DBX100.7", hmi_acknowledgment_tag: "HMI Fehler Quitt WEA_HMI_16_01", hmi_acknowledgment_bit: 7, hmi_acknowledgment_address: "%DB31.DBX403.7", report: 0 },

  // SOLARPARK-SUED — Wechselrichter Bitmeldungen
  { name: "INV_Bitmeldung_01", alarm_text: "F 01 DC-Überspannung",               alarm_class: "Errors",            trigger_tag: "HMI Bereichszeiger.INV_HMI_16_01", trigger_bit: 0, trigger_address: "%DB32.DBX103.0", hmi_acknowledgment_tag: "HMI Fehler Quitt INV_HMI_16_01", hmi_acknowledgment_bit: 0, hmi_acknowledgment_address: "%DB32.DBX403.0", report: 1 },
  { name: "INV_Bitmeldung_02", alarm_text: "F 02 AC-Netzausfall",                alarm_class: "Errors",            trigger_tag: "HMI Bereichszeiger.INV_HMI_16_01", trigger_bit: 1, trigger_address: "%DB32.DBX103.1", hmi_acknowledgment_tag: "HMI Fehler Quitt INV_HMI_16_01", hmi_acknowledgment_bit: 1, hmi_acknowledgment_address: "%DB32.DBX403.1", report: 1 },
  { name: "INV_Bitmeldung_03", alarm_text: "W 03 Ertrag unter Mindestschwelle",  alarm_class: "Warnings",          trigger_tag: "HMI Bereichszeiger.INV_HMI_16_01", trigger_bit: 2, trigger_address: "%DB32.DBX103.2", hmi_acknowledgment_tag: "HMI Fehler Quitt INV_HMI_16_01", hmi_acknowledgment_bit: 2, hmi_acknowledgment_address: "%DB32.DBX403.2", report: 1 },
  { name: "INV_Bitmeldung_04", alarm_text: "B 04 Einspeisebetrieb aktiv",        alarm_class: "Betriebsmeldungen", trigger_tag: "HMI Bereichszeiger.INV_HMI_16_01", trigger_bit: 3, trigger_address: "%DB32.DBX103.3", hmi_acknowledgment_tag: null,                              hmi_acknowledgment_bit: null, hmi_acknowledgment_address: null,              report: 0 },
  { name: "INV_Bitmeldung_05", alarm_text: "N 05 Schattenabschaltung",           alarm_class: "No Acknowledgement",trigger_tag: "HMI Bereichszeiger.INV_HMI_16_01", trigger_bit: 4, trigger_address: "%DB32.DBX103.4", hmi_acknowledgment_tag: null,                              hmi_acknowledgment_bit: null, hmi_acknowledgment_address: null,              report: 0 },

  // BIOMASSE-WEST — Kessel Bitmeldungen
  { name: "Kessel_Bitmeldung_01", alarm_text: "F 01 Druckabsicherung ausgelöst", alarm_class: "Errors",            trigger_tag: "HMI Bereichszeiger.GM_HMI_16_01",  trigger_bit: 0, trigger_address: "%DB33.DBX106.0", hmi_acknowledgment_tag: "HMI Fehler Quitt GM_HMI_16_01",  hmi_acknowledgment_bit: 0, hmi_acknowledgment_address: "%DB33.DBX403.0", report: 1 },
  { name: "Kessel_Bitmeldung_02", alarm_text: "F 02 Kesseltemperatur kritisch",  alarm_class: "Errors",            trigger_tag: "HMI Bereichszeiger.GM_HMI_16_01",  trigger_bit: 1, trigger_address: "%DB33.DBX106.1", hmi_acknowledgment_tag: "HMI Fehler Quitt GM_HMI_16_01",  hmi_acknowledgment_bit: 1, hmi_acknowledgment_address: "%DB33.DBX403.1", report: 1 },
  { name: "Kessel_Bitmeldung_03", alarm_text: "W 03 Brennstoffzufuhr gering",    alarm_class: "Warnings",          trigger_tag: "HMI Bereichszeiger.GM_HMI_16_01",  trigger_bit: 2, trigger_address: "%DB33.DBX106.2", hmi_acknowledgment_tag: "HMI Fehler Quitt GM_HMI_16_01",  hmi_acknowledgment_bit: 2, hmi_acknowledgment_address: "%DB33.DBX403.2", report: 1 },
  { name: "Kessel_Bitmeldung_04", alarm_text: "B 04 Kessel in Betrieb",          alarm_class: "Betriebsmeldungen", trigger_tag: "HMI Bereichszeiger.GM_HMI_16_01",  trigger_bit: 3, trigger_address: "%DB33.DBX106.3", hmi_acknowledgment_tag: null,                              hmi_acknowledgment_bit: null, hmi_acknowledgment_address: null,              report: 0 },
  { name: "Kessel_Bitmeldung_05", alarm_text: "A 05 Wartung fällig",             alarm_class: "Acknowledgement",   trigger_tag: "HMI Bereichszeiger.GM_HMI_16_01",  trigger_bit: 4, trigger_address: "%DB33.DBX106.4", hmi_acknowledgment_tag: "HMI Fehler Quitt GM_HMI_16_01",  hmi_acknowledgment_bit: 4, hmi_acknowledgment_address: "%DB33.DBX403.4", report: 0 },
  { name: "Kessel_Bitmeldung_06", alarm_text: "F 06 Notabschaltung ausgelöst",   alarm_class: "Errors",            trigger_tag: "HMI Bereichszeiger.GM_HMI_16_01",  trigger_bit: 5, trigger_address: "%DB33.DBX106.5", hmi_acknowledgment_tag: "HMI Fehler Quitt GM_HMI_16_01",  hmi_acknowledgment_bit: 5, hmi_acknowledgment_address: "%DB33.DBX403.5", report: 1 },
];

const insMsgText = db.prepare(
  `INSERT OR IGNORE INTO mdm_message_text
     (name, alarm_text, alarm_class, trigger_tag, trigger_bit, trigger_address,
      hmi_acknowledgment_tag, hmi_acknowledgment_bit, hmi_acknowledgment_address, report,
      create_user, create_timestamp, modify_user, modify_timestamp, modify_status, version)
   VALUES
     (@name, @alarm_text, @alarm_class, @trigger_tag, @trigger_bit, @trigger_address,
      @hmi_acknowledgment_tag, @hmi_acknowledgment_bit, @hmi_acknowledgment_address, @report,
      @u, @ts, @u, @ts, 'inserted', 1)`
);
db.transaction(() => messageTexts.forEach((m) => insMsgText.run({ ...m, u: USER, ts: NOW })))();
console.log(`   ✓ ${messageTexts.length} Meldungstexte`);

console.log("\n✅ Seed abgeschlossen.");
console.log(`   Login:    ${USER}`);
console.log(`   Passwort: Herbert1!`);
} // end main

main().catch((e) => { console.error(e); process.exit(1); });
