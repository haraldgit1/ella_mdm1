import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditInsert } from "@/lib/audit/audit";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectName    = searchParams.get("project_name") ?? "";
  const alarmLevelCode = searchParams.get("alarm_level_code") ?? "";
  const alarmText      = searchParams.get("alarm_text") ?? "";

  const conditions: string[] = ["modify_status != 'deleted'"];
  const params: unknown[] = [];

  if (projectName)    { conditions.push("project_name LIKE ?");    params.push(`%${projectName}%`); }
  if (alarmLevelCode) { conditions.push("alarm_level_code LIKE ?"); params.push(`%${alarmLevelCode}%`); }
  if (alarmText)      { conditions.push("alarm_text LIKE ?");       params.push(`%${alarmText}%`); }

  const rows = getDb()
    .prepare(
      `SELECT project_name, alarm_level_code, alarm_text, severity_rank, modify_status, version
       FROM mdm_project_alarm
       WHERE ${conditions.join(" AND ")}
       ORDER BY project_name, severity_rank, alarm_level_code`
    )
    .all(...params);

  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body: { project_name: string; alarm_level_code: string; alarm_text: string; severity_rank?: number } =
    await request.json();

  if (!body.project_name?.trim())     return Response.json({ error: "ProjektName fehlt" }, { status: 400 });
  if (!body.alarm_level_code?.trim()) return Response.json({ error: "Alarm-Stufe fehlt" }, { status: 400 });
  if (!body.alarm_text?.trim())       return Response.json({ error: "Alarm-Text fehlt" }, { status: 400 });

  const audit = auditInsert(session.user.email);

  try {
    getDb().prepare(
      `INSERT INTO mdm_project_alarm
        (project_name, alarm_level_code, alarm_text, severity_rank,
         create_user, create_timestamp, modify_user, modify_timestamp, modify_status, version)
       VALUES
        (@project_name, @alarm_level_code, @alarm_text, @severity_rank,
         @create_user, @create_timestamp, @modify_user, @modify_timestamp, @modify_status, @version)`
    ).run({ ...body, severity_rank: body.severity_rank ?? null, ...audit });

    return Response.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fehler";
    if (msg.includes("UNIQUE")) return Response.json({ error: "Alarm-Stufe bereits vorhanden" }, { status: 409 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
