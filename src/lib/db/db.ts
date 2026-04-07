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
  }
  return _db;
}

function initSchema(db: Database.Database) {
  const schemaPath = path.join(process.cwd(), "src/lib/db/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");

  // SQLite pragmas can't run in exec together with CREATE statements reliably,
  // so we split and run statement by statement, skipping PRAGMA lines (already set above).
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.toUpperCase().startsWith("PRAGMA"));

  for (const stmt of statements) {
    db.exec(stmt + ";");
  }
}
