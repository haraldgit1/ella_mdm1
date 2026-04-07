import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditInsert } from "@/lib/audit/audit";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const projectName = new URL(request.url).searchParams.get("projectName");
  if (!projectName) return Response.json({ error: "projectName fehlt" }, { status: 400 });

  const rows = getDb()
    .prepare(
      `SELECT alarm_level_code, alarm_text, severity_rank
       FROM mdm_project_alarm
       WHERE project_name = ? AND modify_status != 'deleted'
       ORDER BY severity_rank, alarm_level_code`
    )
    .all(projectName);

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
         create_user, create_timestamp, modify_user, modify_timestamp, modify_status)
       VALUES
        (@project_name, @alarm_level_code, @alarm_text, @severity_rank,
         @create_user, @create_timestamp, @modify_user, @modify_timestamp, @modify_status)`
    ).run({ ...body, severity_rank: body.severity_rank ?? null, ...audit });

    return Response.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fehler";
    if (msg.includes("UNIQUE")) return Response.json({ error: "Alarm-Stufe bereits vorhanden" }, { status: 409 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
