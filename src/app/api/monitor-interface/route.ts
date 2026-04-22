import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body: { project_name: string; monitor_name: string } = await request.json();
  if (!body.project_name?.trim()) return Response.json({ error: "ProjektName fehlt" }, { status: 400 });
  if (!body.monitor_name?.trim())  return Response.json({ error: "MonitorName fehlt" }, { status: 400 });

  const vars = getDb().prepare(
    `SELECT name FROM mdm_monitor_variable
     WHERE project_name = ? AND monitor_name = ? AND modify_status != 'deleted'
     ORDER BY CAST(offset AS REAL)`
  ).all(body.project_name, body.monitor_name) as { name: string }[];

  if (vars.length === 0) {
    return Response.json({ error: "Keine Variablen für diesen Monitor gefunden" }, { status: 404 });
  }

  const mn = body.monitor_name;
  const lines = vars.map((v, i) => {
    const comma = i < vars.length - 1 ? "," : "";
    return `    "${v.name}": :="${mn}".${v.name}:${comma}`;
  });

  const content = `{\n  "${mn}" {\n${lines.join("\n")}\n  }\n}\n`;

  const filename = mn.replace(/ /g, "_") + ".html";
  const dataDir = join(process.cwd(), "data");

  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, filename), content, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler beim Schreiben";
    return Response.json({ error: msg }, { status: 500 });
  }

  return Response.json({ ok: true, filename, count: vars.length });
}
