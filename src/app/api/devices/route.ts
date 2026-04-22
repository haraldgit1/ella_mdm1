import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditInsert } from "@/lib/audit/audit";
import type { DeviceInput } from "@/types/device";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectName  = searchParams.get("project_name") ?? "";
  const deviceName   = searchParams.get("device_name") ?? "";
  const title        = searchParams.get("title") ?? "";
  const typeCode     = searchParams.get("device_type_code") ?? "";
  const status       = searchParams.get("status") ?? "";
  const alarmEnabled = searchParams.get("alarm_enabled") ?? "";

  const conditions: string[] = ["d.modify_status != 'deleted'"];
  const params: (string | number | null)[] = [];

  if (projectName)  { conditions.push("d.project_name LIKE ?");    params.push(`%${projectName}%`); }
  if (deviceName)   { conditions.push("d.device_name LIKE ?");     params.push(`%${deviceName}%`); }
  if (title)        { conditions.push("d.title LIKE ?");           params.push(`%${title}%`); }
  if (typeCode)     { conditions.push("d.device_type_code = ?");   params.push(typeCode); }
  if (status)       { conditions.push("d.status = ?");             params.push(status); }
  if (alarmEnabled) { conditions.push("d.alarm_enabled = ?");      params.push(alarmEnabled === "1" ? 1 : 0); }

  const rows = getDb().prepare(
    `SELECT d.project_name, d.device_name, d.title, d.device_type_code,
            d.status, d.alarm_enabled, d.modify_status, d.version
     FROM mdm_device d
     WHERE ${conditions.join(" AND ")}
     ORDER BY d.project_name, d.device_name`
  ).all(...params);

  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body: DeviceInput = await request.json();

  if (!body.project_name?.trim())    return Response.json({ error: "ProjektName ist Pflichtfeld" }, { status: 400 });
  if (!body.device_name?.trim())     return Response.json({ error: "DeviceName ist Pflichtfeld" }, { status: 400 });
  if (!body.title?.trim())           return Response.json({ error: "Bezeichnung ist Pflichtfeld" }, { status: 400 });
  if (!body.device_type_code?.trim()) return Response.json({ error: "Typ ist Pflichtfeld" }, { status: 400 });

  if (body.limit_min_value !== undefined && body.limit_max_value !== undefined) {
    if (body.limit_min_value > body.limit_max_value)
      return Response.json({ error: "Limit-Min muss ≤ Limit-Max sein" }, { status: 400 });
  }

  const audit = auditInsert(session.user.email);

  try {
    getDb().prepare(
      `INSERT INTO mdm_device (
        project_name, device_name, title, device_type_code, status,
        short_description_json, limit_min_value, limit_max_value,
        alarm_enabled, alarm_timestamp, alarm_level_code, detail_json,
        create_user, create_timestamp, modify_user, modify_timestamp, modify_status, version
      ) VALUES (
        @project_name, @device_name, @title, @device_type_code, @status,
        @short_description_json, @limit_min_value, @limit_max_value,
        @alarm_enabled, @alarm_timestamp, @alarm_level_code, @detail_json,
        @create_user, @create_timestamp, @modify_user, @modify_timestamp, @modify_status, @version
      )`
    ).run({
      ...body,
      alarm_enabled: body.alarm_enabled ?? 0,
      status: body.status ?? "active",
      short_description_json: body.short_description_json?.trim() || null,
      detail_json: body.detail_json?.trim() || null,
      alarm_level_code: body.alarm_level_code?.trim() || null,
      alarm_timestamp: body.alarm_timestamp?.trim() || null,
      limit_min_value: body.limit_min_value ?? null,
      limit_max_value: body.limit_max_value ?? null,
      ...audit,
    });

    return Response.json({ project_name: body.project_name, device_name: body.device_name }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fehler beim Speichern";
    if (msg.includes("UNIQUE"))   return Response.json({ error: "Device bereits vorhanden" }, { status: 409 });
    if (msg.includes("FOREIGN"))  return Response.json({ error: "Projekt existiert nicht" }, { status: 400 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
