import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body: { project_name: string; device_name: string } = await request.json();
  if (!body.project_name?.trim()) return Response.json({ error: "ProjektName fehlt" }, { status: 400 });
  if (!body.device_name?.trim())  return Response.json({ error: "DeviceName fehlt" }, { status: 400 });

  const vars = getDb().prepare(
    `SELECT name FROM mdm_device_variable
     WHERE project_name = ? AND device_name = ? AND modify_status != 'deleted'
     ORDER BY CAST(offset AS REAL)`
  ).all(body.project_name, body.device_name) as { name: string }[];

  if (vars.length === 0) {
    return Response.json({ error: "Keine Variablen für dieses Device gefunden" }, { status: 404 });
  }

  const dn = body.device_name;
  const lines = vars.map((v, i) => {
    const comma = i < vars.length - 1 ? "," : "";
    return `    "${v.name}": :="${dn}".${v.name}:${comma}`;
  });

  const content = `{\n  "${dn}" {\n${lines.join("\n")}\n  }\n}\n`;

  const filename = dn.replace(/ /g, "_") + ".html";
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
