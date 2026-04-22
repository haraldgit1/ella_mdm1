import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditInsert } from "@/lib/audit/audit";
import type { MonitorVariableInput } from "@/types/monitor";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("project_name") ?? "";
  const monitorName = searchParams.get("monitor_name") ?? "";

  const conditions: string[] = ["modify_status != 'deleted'"];
  const params: (string | number | null)[] = [];

  if (projectName) { conditions.push("project_name = ?"); params.push(projectName); }
  if (monitorName) { conditions.push("monitor_name = ?"); params.push(monitorName); }

  const rows = getDb().prepare(
    `SELECT * FROM mdm_monitor_variable
     WHERE ${conditions.join(" AND ")}
     ORDER BY project_name, monitor_name, CAST(offset AS REAL)`
  ).all(...params);

  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body: MonitorVariableInput = await request.json();

  if (!body.project_name?.trim()) return Response.json({ error: "ProjektName ist Pflichtfeld" }, { status: 400 });
  if (!body.monitor_name?.trim()) return Response.json({ error: "MonitorName ist Pflichtfeld" }, { status: 400 });
  if (!body.name?.trim())         return Response.json({ error: "Name ist Pflichtfeld" }, { status: 400 });
  if (!body.data_type?.trim())    return Response.json({ error: "DataType ist Pflichtfeld" }, { status: 400 });

  const audit = auditInsert(session.user.email);

  try {
    getDb().prepare(
      `INSERT INTO mdm_monitor_variable (
        project_name, monitor_name, name, title, datablock, data_type, offset,
        create_user, create_timestamp, modify_user, modify_timestamp, modify_status, version
      ) VALUES (
        @project_name, @monitor_name, @name, @title, @datablock, @data_type, @offset,
        @create_user, @create_timestamp, @modify_user, @modify_timestamp, @modify_status, @version
      )`
    ).run({
      ...body,
      datablock: body.datablock?.trim() || null,
      offset: body.offset?.trim() || null,
      ...audit,
    });

    return Response.json({ project_name: body.project_name, monitor_name: body.monitor_name, name: body.name }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fehler beim Speichern";
    if (msg.includes("UNIQUE"))  return Response.json({ error: "Variable bereits vorhanden" }, { status: 409 });
    if (msg.includes("FOREIGN")) return Response.json({ error: "Monitor existiert nicht" }, { status: 400 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
