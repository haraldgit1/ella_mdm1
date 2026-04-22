import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _db = new Database(path.join(process.cwd(), "ella_mdm.db"));
    _db.run("PRAGMA foreign_keys = ON");
    _db.run("PRAGMA journal_mode = WAL");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database) {
  const schemaPath = path.join(process.cwd(), "src/lib/db/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.toUpperCase().startsWith("PRAGMA"));

  for (const stmt of statements) {
    db.run(stmt + ";");
  }
}
