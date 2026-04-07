import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditDelete } from "@/lib/audit/audit";

type Ctx = { params: Promise<{ projectName: string; alarmLevelCode: string }> };

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, alarmLevelCode } = await ctx.params;
  const audit = auditDelete(session.user.email);

  getDb().prepare(
    `UPDATE mdm_project_alarm
     SET modify_user=@modify_user, modify_timestamp=@modify_timestamp, modify_status=@modify_status
     WHERE project_name=@project_name AND alarm_level_code=@alarm_level_code`
  ).run({ ...audit, project_name: projectName, alarm_level_code: alarmLevelCode });

  return Response.json({ ok: true });
}
