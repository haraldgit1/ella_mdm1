import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditInsert } from "@/lib/audit/audit";
import type { MonitorInput } from "@/types/monitor";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectName  = searchParams.get("project_name") ?? "";
  const monitorName  = searchParams.get("monitor_name") ?? "";
  const title        = searchParams.get("title") ?? "";
  const type         = searchParams.get("type") ?? "";
  const status       = searchParams.get("status") ?? "";

  const conditions: string[] = ["modify_status != 'deleted'"];
  const params: unknown[] = [];

  if (projectName) { conditions.push("project_name LIKE ?"); params.push(`%${projectName}%`); }
  if (monitorName) { conditions.push("monitor_name LIKE ?"); params.push(`%${monitorName}%`); }
  if (title)       { conditions.push("title LIKE ?");        params.push(`%${title}%`); }
  if (type)        { conditions.push("type = ?");            params.push(type); }
  if (status)      { conditions.push("status = ?");          params.push(status); }

  const rows = getDb().prepare(
    `SELECT project_name, monitor_name, title, status, type, datablock, modify_status, version
     FROM mdm_monitor
     WHERE ${conditions.join(" AND ")}
     ORDER BY project_name, monitor_name`
  ).all(...params);

  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body: MonitorInput = await request.json();

  if (!body.project_name?.trim())  return Response.json({ error: "ProjektName ist Pflichtfeld" }, { status: 400 });
  if (!body.monitor_name?.trim())  return Response.json({ error: "MonitorName ist Pflichtfeld" }, { status: 400 });
  if (!body.title?.trim())         return Response.json({ error: "Bezeichnung ist Pflichtfeld" }, { status: 400 });

  const audit = auditInsert(session.user.email);

  try {
    getDb().prepare(
      `INSERT INTO mdm_monitor (
        project_name, monitor_name, title, status, type, datablock,
        request_url, response_file, short_description, detail_json,
        create_user, create_timestamp, modify_user, modify_timestamp, modify_status, version
      ) VALUES (
        @project_name, @monitor_name, @title, @status, @type, @datablock,
        @request_url, @response_file, @short_description, @detail_json,
        @create_user, @create_timestamp, @modify_user, @modify_timestamp, @modify_status, @version
      )`
    ).run({
      ...body,
      status: body.status ?? "active",
      type: body.type?.trim() || null,
      datablock: body.datablock?.trim() || null,
      request_url: body.request_url?.trim() || null,
      response_file: body.response_file?.trim() || null,
      short_description: body.short_description?.trim() || null,
      detail_json: body.detail_json?.trim() || null,
      ...audit,
    });

    return Response.json({ project_name: body.project_name, monitor_name: body.monitor_name }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fehler beim Speichern";
    if (msg.includes("UNIQUE"))  return Response.json({ error: "Monitor bereits vorhanden" }, { status: 409 });
    if (msg.includes("FOREIGN")) return Response.json({ error: "Projekt existiert nicht" }, { status: 400 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
