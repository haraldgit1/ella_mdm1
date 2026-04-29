import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(path.join(process.cwd(), "ella_mdm.db"));
    _db.pragma("foreign_keys = ON");
    _db.pragma("journal_mode = WAL");
    initSchema(_db);
    runMigrations(_db);
  }
  return _db;
}

/** Returns the next unique value_id for a new mdm_monitor_variable row. */
export function nextMonitorVariableId(): number {
  const { lastInsertRowid } = getDb()
    .prepare("INSERT INTO seq_monitor_variable DEFAULT VALUES")
    .run();
  return Number(lastInsertRowid);
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function runMigrations(db: Database.Database) {
  // ── better-auth admin plugin: extend user + session tables if they exist ──
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all() as { name: string }[];
  const tableNames = tables.map((t) => t.name);

  if (tableNames.includes("user")) {
    addColumnIfMissing(db, "user", "role",      "TEXT");
    addColumnIfMissing(db, "user", "banned",    "INTEGER DEFAULT 0");
    addColumnIfMissing(db, "user", "banReason", "TEXT");
    addColumnIfMissing(db, "user", "banExpires","DATETIME");
  }
  if (tableNames.includes("session")) {
    addColumnIfMissing(db, "session", "impersonatedBy", "TEXT");
  }

  // Add value_id column to mdm_monitor_variable (SQLite: ADD COLUMN is safe to run multiple times via the check)
  const cols = db.prepare("PRAGMA table_info(mdm_monitor_variable)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "value_id")) {
    db.exec("ALTER TABLE mdm_monitor_variable ADD COLUMN value_id INTEGER");
  }

  // Unique index (CREATE IF NOT EXISTS is idempotent)
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS uidx_monitor_variable_value_id
     ON mdm_monitor_variable(value_id) WHERE value_id IS NOT NULL`
  );

  // Populate value_id for existing rows that don't have one yet
  const unpopulated = db
    .prepare("SELECT project_name, monitor_name, name FROM mdm_monitor_variable WHERE value_id IS NULL")
    .all() as { project_name: string; monitor_name: string; name: string }[];

  if (unpopulated.length > 0) {
    const insertSeq = db.prepare("INSERT INTO seq_monitor_variable DEFAULT VALUES");
    const setId = db.prepare(
      "UPDATE mdm_monitor_variable SET value_id = ? WHERE project_name = ? AND monitor_name = ? AND name = ?"
    );
    db.transaction(() => {
      for (const row of unpopulated) {
        const { lastInsertRowid } = insertSeq.run();
        setId.run(lastInsertRowid, row.project_name, row.monitor_name, row.name);
      }
    })();
  }
}

function initSchema(db: Database.Database) {
  const schemaPath = path.join(process.cwd(), "src/lib/db/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.toUpperCase().startsWith("PRAGMA"));

  for (const stmt of statements) {
    db.exec(stmt + ";");
  }
}
