import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditDelete } from "@/lib/audit/audit";

type Ctx = { params: Promise<{ projectName: string; emailAddress: string }> };

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, emailAddress } = await ctx.params;
  const audit = auditDelete(session.user.email);

  getDb().prepare(
    `UPDATE mdm_project_email
     SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
         modify_status=@modify_status, version=version+1
     WHERE project_name=@project_name AND email_address=@email_address`
  ).run({ ...audit, project_name: projectName, email_address: decodeURIComponent(emailAddress) });

  return Response.json({ ok: true });
}
