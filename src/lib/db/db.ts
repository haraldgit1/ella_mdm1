import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(path.join(process.cwd(), "ella_mdm.db"));
    _db.pragma("foreign_keys = ON");
    _db.pragma("journal_mode = WAL");
    preInitMigrations(_db);
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

/** Drops tables with obsolete structure before initSchema recreates them. */
function preInitMigrations(db: Database.Database) {
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all() as { name: string }[];
  if (tables.some((t) => t.name === "mdm_message_text")) {
    const cols = db.prepare("PRAGMA table_info(mdm_message_text)").all() as { name: string }[];
    if (!cols.some((c) => c.name === "message_name")) {
      db.exec("DROP TABLE IF EXISTS mdm_message_text");
      db.exec("DROP INDEX IF EXISTS idx_message_text_name");
      db.exec("DROP INDEX IF EXISTS idx_message_text_alarm_class");
      db.exec("DROP INDEX IF EXISTS idx_message_text_trigger_tag");
      db.exec("DROP INDEX IF EXISTS idx_message_text_status");
    }
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

  // ── mdm_message_text: Rebuild mit neuem PK (project_name, message_name) ──
  if (tableNames.includes("mdm_message_text")) {
    const msgCols = db.prepare("PRAGMA table_info(mdm_message_text)").all() as { name: string }[];
    if (!msgCols.some((c) => c.name === "message_name")) {
      db.exec("DROP TABLE IF EXISTS mdm_message_text");
      db.exec(`
        CREATE TABLE mdm_message_text (
          project_name               TEXT    NOT NULL,
          message_name               TEXT    NOT NULL,
          id                         INTEGER NOT NULL,
          message_text               TEXT    NOT NULL,
          message_class              TEXT,
          trigger_tag                TEXT,
          trigger_bit                INTEGER CHECK (trigger_bit IS NULL OR (trigger_bit >= 0 AND trigger_bit <= 15)),
          trigger_address            TEXT,
          hmi_acknowledgment_tag     TEXT,
          hmi_acknowledgment_bit     INTEGER CHECK (hmi_acknowledgment_bit IS NULL OR (hmi_acknowledgment_bit >= 0 AND hmi_acknowledgment_bit <= 15)),
          hmi_acknowledgment_address TEXT,
          report                     INTEGER NOT NULL DEFAULT 0 CHECK (report IN (0, 1)),
          create_user                TEXT    NOT NULL,
          create_timestamp           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          modify_user                TEXT    NOT NULL,
          modify_timestamp           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          modify_status              TEXT    NOT NULL DEFAULT 'inserted'
                                            CHECK (modify_status IN ('inserted','updated','locked','deleted')),
          version                    INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (project_name, message_name),
          FOREIGN KEY (project_name)
              REFERENCES mdm_project(project_name)
              ON UPDATE CASCADE
              ON DELETE RESTRICT
        )
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_message_text_project       ON mdm_message_text(project_name)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_message_text_message_class ON mdm_message_text(message_class)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_message_text_trigger_tag   ON mdm_message_text(trigger_tag)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_message_text_status        ON mdm_message_text(modify_status)`);
    }
  }

  // ── ts_monitor_value: bit_value + workflow fields ────────────────────────
  addColumnIfMissing(db, "ts_monitor_value", "bit_value",        "TEXT");
  addColumnIfMissing(db, "ts_monitor_value", "co_id",            "TEXT");
  // DEFAULT 'send' für bestehende Zeilen → verhindert E-Mail-Flut beim ersten Lauf
  addColumnIfMissing(db, "ts_monitor_value", "status",           "TEXT DEFAULT 'send'");
  addColumnIfMissing(db, "ts_monitor_value", "status_timestamp", "TEXT");

  db.exec(`CREATE INDEX IF NOT EXISTS idx_ts_monitor_value_status ON ts_monitor_value(status, value_id)`);

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
