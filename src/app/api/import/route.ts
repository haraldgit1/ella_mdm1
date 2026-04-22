import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { importCsv, type ImportType } from "@/lib/import/import-handler";
import { randomUUID } from "crypto";

const VALID_TYPES: ImportType[] = ["projects", "devices", "alarms", "emails", "lookups", "variables", "monitor_variables"];
const VALID_CHARSETS = ["utf-8", "windows-1252", "iso-8859-1"];

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const formData = await request.formData();
  const type = formData.get("type") as ImportType;
  const file = formData.get("file") as File | null;
  const charsetRaw = (formData.get("charset") as string | null) ?? "utf-8";
  const charset = VALID_CHARSETS.includes(charsetRaw) ? charsetRaw : "utf-8";

  if (!VALID_TYPES.includes(type)) {
    return Response.json({ error: "Ungültiger Import-Typ" }, { status: 400 });
  }
  if (!file) {
    return Response.json({ error: "Keine Datei angegeben" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const csvText = new TextDecoder(charset).decode(buffer);
  const importId = randomUUID();
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  // Import-Log: Start
  db.prepare(
    `INSERT INTO mdm_import_log (import_id, import_type, source_filename, started_at, imported_by, status)
     VALUES (?, ?, ?, ?, ?, 'running')`
  ).run(importId, type, file.name, now, session.user.email);

  let result;
  try {
    result = importCsv(type, csvText, session.user.email);

    const finishedAt = new Date().toISOString().replace("T", " ").slice(0, 19);
    const status = result.errors.length === 0 ? "success" : result.imported + result.updated > 0 ? "warning" : "error";
    db.prepare(
      `UPDATE mdm_import_log SET finished_at=?, status=?, message=?, result_json=? WHERE import_id=?`
    ).run(
      finishedAt,
      status,
      `${result.imported} neu, ${result.updated} aktualisiert, ${result.errors.length} Fehler`,
      JSON.stringify(result),
      importId
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    db.prepare(
      `UPDATE mdm_import_log SET finished_at=?, status='error', message=? WHERE import_id=?`
    ).run(new Date().toISOString().replace("T", " ").slice(0, 19), msg, importId);
    return Response.json({ error: msg }, { status: 500 });
  }

  return Response.json({ importId, ...result });
}
