import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditInsert } from "@/lib/audit/audit";
import type { DeviceVariableInput } from "@/types/variable";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("project_name") ?? "";
  const deviceName  = searchParams.get("device_name")  ?? "";
  const name        = searchParams.get("name")         ?? "";
  const title       = searchParams.get("title")        ?? "";
  const dataType    = searchParams.get("data_type")    ?? "";

  const conditions: string[] = ["modify_status != 'deleted'"];
  const params: unknown[] = [];

  if (projectName) { conditions.push("project_name LIKE ?"); params.push(`%${projectName}%`); }
  if (deviceName)  { conditions.push("device_name LIKE ?");  params.push(`%${deviceName}%`); }
  if (name)        { conditions.push("name LIKE ?");         params.push(`%${name}%`); }
  if (title)       { conditions.push("title LIKE ?");        params.push(`%${title}%`); }
  if (dataType)    { conditions.push("data_type = ?");       params.push(dataType); }

  const rows = getDb()
    .prepare(
      `SELECT project_name, device_name, name, title, data_type,
              offset, range, unit, detail_json,
              create_user, create_timestamp, modify_user, modify_timestamp, modify_status, version
       FROM mdm_device_variable
       WHERE ${conditions.join(" AND ")}
       ORDER BY project_name, device_name, name`
    )
    .all(...params);

  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body: DeviceVariableInput = await request.json();

  if (!body.project_name?.trim()) return Response.json({ error: "ProjektName fehlt" }, { status: 400 });
  if (!body.device_name?.trim())  return Response.json({ error: "DeviceName fehlt" }, { status: 400 });
  if (!body.name?.trim())         return Response.json({ error: "Name fehlt" }, { status: 400 });
  if (!body.title?.trim())        return Response.json({ error: "Bezeichnung fehlt" }, { status: 400 });
  if (!body.data_type?.trim())    return Response.json({ error: "DataType fehlt" }, { status: 400 });

  const audit = auditInsert(session.user.email);

  try {
    getDb().prepare(
      `INSERT INTO mdm_device_variable
        (project_name, device_name, name, title, data_type, offset, range, unit, detail_json,
         create_user, create_timestamp, modify_user, modify_timestamp, modify_status, version)
       VALUES
        (@project_name, @device_name, @name, @title, @data_type, @offset, @range, @unit, @detail_json,
         @create_user, @create_timestamp, @modify_user, @modify_timestamp, @modify_status, @version)`
    ).run({
      ...body,
      offset: body.offset?.trim() || null,
      range: body.range?.trim() || null,
      unit: body.unit?.trim() || null,
      detail_json: body.detail_json?.trim() || null,
      ...audit,
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fehler";
    if (msg.includes("UNIQUE"))  return Response.json({ error: "Variable bereits vorhanden" }, { status: 409 });
    if (msg.includes("FOREIGN")) return Response.json({ error: "Device existiert nicht" }, { status: 400 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
