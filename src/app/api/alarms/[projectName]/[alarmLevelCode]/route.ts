import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditUpdate, auditDelete } from "@/lib/audit/audit";

type Ctx = { params: Promise<{ projectName: string; alarmLevelCode: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, alarmLevelCode } = await ctx.params;
  const body: { alarm_text: string; severity_rank?: number } = await request.json();

  if (!body.alarm_text?.trim()) return Response.json({ error: "Alarm-Text fehlt" }, { status: 400 });

  const audit = auditUpdate(session.user.email);
  const result = getDb()
    .prepare(
      `UPDATE mdm_project_alarm
       SET alarm_text=@alarm_text, severity_rank=@severity_rank,
           modify_user=@modify_user, modify_timestamp=@modify_timestamp, modify_status=@modify_status
       WHERE project_name=@project_name AND alarm_level_code=@alarm_level_code
         AND modify_status != 'deleted'`
    )
    .run({
      alarm_text: body.alarm_text,
      severity_rank: body.severity_rank ?? null,
      ...audit,
      project_name: decodeURIComponent(projectName),
      alarm_level_code: decodeURIComponent(alarmLevelCode),
    });

  if (result.changes === 0) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, alarmLevelCode } = await ctx.params;
  const audit = auditDelete(session.user.email);

  const result = getDb().prepare(
    `UPDATE mdm_project_alarm
     SET modify_user=@modify_user, modify_timestamp=@modify_timestamp, modify_status=@modify_status
     WHERE project_name=@project_name AND alarm_level_code=@alarm_level_code
       AND modify_status != 'deleted'`
  ).run({ ...audit, project_name: decodeURIComponent(projectName), alarm_level_code: decodeURIComponent(alarmLevelCode) });

  if (result.changes === 0) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  return Response.json({ ok: true });
}
