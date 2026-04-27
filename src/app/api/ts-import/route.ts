import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectName = (formData.get("project_name") as string | null)?.trim();
  const monitorName = (formData.get("monitor_name") as string | null)?.trim();
  const tsRaw = (formData.get("ts") as string | null)?.trim();

  if (!file)        return Response.json({ error: "Keine Datei" }, { status: 400 });
  if (!projectName) return Response.json({ error: "project_name fehlt" }, { status: 400 });
  if (!monitorName) return Response.json({ error: "monitor_name fehlt" }, { status: 400 });

  const ts = tsRaw ? new Date(tsRaw).toISOString() : new Date().toISOString();

  // Parse SPS JSON format — outer key has no colon: "MonitorName" { ... }
  const content = await file.text();
  let values: Record<string, unknown>;
  try {
    const fixed = content.replace(/"([^"]+)"\s*\{/g, '"$1": {');
    const parsed = JSON.parse(fixed) as Record<string, unknown>;
    const outerKeys = Object.keys(parsed);
    const first = outerKeys.length === 1 ? parsed[outerKeys[0]] : null;
    values = (first && typeof first === "object" && !Array.isArray(first))
      ? (first as Record<string, unknown>)
      : parsed;
  } catch {
    return Response.json({ error: "Ungültiges JSON-Format" }, { status: 400 });
  }

  const db = getDb();

  // Build varName → value_id lookup for this monitor
  const varRows = db.prepare(
    `SELECT name, value_id FROM mdm_monitor_variable
     WHERE project_name = ? AND monitor_name = ? AND modify_status != 'deleted' AND value_id IS NOT NULL`
  ).all(projectName, monitorName) as { name: string; value_id: number }[];

  if (varRows.length === 0) {
    return Response.json({ error: "Keine Variablen mit value_id für diesen Monitor gefunden" }, { status: 404 });
  }

  const valueIdMap = new Map(varRows.map((r) => [r.name, r.value_id]));
  const insert = db.prepare("INSERT INTO ts_monitor_value (ts, value_id, value) VALUES (?, ?, ?)");

  let imported = 0;
  let skipped = 0;

  db.transaction(() => {
    for (const [varName, val] of Object.entries(values)) {
      const valueId = valueIdMap.get(varName);
      if (valueId == null) { skipped++; continue; }
      const num = typeof val === "number" ? val : parseFloat(String(val));
      insert.run(ts, valueId, isNaN(num) ? null : num);
      imported++;
    }
  })();

  return Response.json({ imported, skipped, ts });
}
