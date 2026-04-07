/**
 * Seed-Script: Lookup-Tabelle mit Grunddaten befüllen.
 * Ausführen mit: npx tsx src/lib/db/seed.ts
 */
import { getDb } from "./db";

const db = getDb();

const lookups = [
  // DeviceType (function_code = 100)
  { function_code: 100, code: "1", description: "Sensor",      function_text: "DeviceType" },
  { function_code: 100, code: "2", description: "Motor",       function_text: "DeviceType" },
  { function_code: 100, code: "3", description: "Pumpe",       function_text: "DeviceType" },
  { function_code: 100, code: "4", description: "Ventil",      function_text: "DeviceType" },
  { function_code: 100, code: "5", description: "Regler",      function_text: "DeviceType" },

  // ProjectType (function_code = 200)
  { function_code: 200, code: "1", description: "Kraftwerk",   function_text: "ProjectType" },
  { function_code: 200, code: "2", description: "Anlage",      function_text: "ProjectType" },
  { function_code: 200, code: "3", description: "Gebäude",     function_text: "ProjectType" },
  { function_code: 200, code: "4", description: "Infrastruktur", function_text: "ProjectType" },
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO mdm_lookup
    (function_code, code, description, function_text, create_user, modify_user, modify_status)
  VALUES
    (@function_code, @code, @description, @function_text, 'system', 'system', 'inserted')
`);

const insertMany = db.transaction((rows: typeof lookups) => {
  for (const row of rows) insert.run(row);
});

insertMany(lookups);

console.log(`Seed abgeschlossen: ${lookups.length} Lookup-Einträge eingefügt (INSERT OR IGNORE).`);
