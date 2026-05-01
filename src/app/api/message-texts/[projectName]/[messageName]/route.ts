import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditUpdate, auditDelete } from "@/lib/audit/audit";

type Ctx = { params: Promise<{ projectName: string; messageName: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, messageName } = await ctx.params;
  const body = await request.json();

  if (!body.message_text?.trim()) return Response.json({ error: "Meldungstext fehlt" }, { status: 400 });

  const audit = auditUpdate(session.user.email);
  const result = getDb()
    .prepare(
      `UPDATE mdm_message_text
       SET message_text=@message_text, message_class=@message_class,
           trigger_tag=@trigger_tag, trigger_bit=@trigger_bit, trigger_address=@trigger_address,
           hmi_acknowledgment_tag=@hmi_acknowledgment_tag,
           hmi_acknowledgment_bit=@hmi_acknowledgment_bit,
           hmi_acknowledgment_address=@hmi_acknowledgment_address,
           report=@report,
           modify_user=@modify_user, modify_timestamp=@modify_timestamp,
           modify_status=@modify_status, version=version+1
       WHERE project_name=@project_name AND message_name=@message_name
         AND modify_status != 'deleted'`
    )
    .run({
      project_name:               decodeURIComponent(projectName),
      message_name:               decodeURIComponent(messageName),
      message_text:               body.message_text.trim(),
      message_class:              body.message_class?.trim() || null,
      trigger_tag:                body.trigger_tag?.trim() || null,
      trigger_bit:                body.trigger_bit != null && body.trigger_bit !== "" ? Number(body.trigger_bit) : null,
      trigger_address:            body.trigger_address?.trim() || null,
      hmi_acknowledgment_tag:     body.hmi_acknowledgment_tag?.trim() || null,
      hmi_acknowledgment_bit:     body.hmi_acknowledgment_bit != null && body.hmi_acknowledgment_bit !== "" ? Number(body.hmi_acknowledgment_bit) : null,
      hmi_acknowledgment_address: body.hmi_acknowledgment_address?.trim() || null,
      report:                     body.report ? 1 : 0,
      ...audit,
    });

  if (result.changes === 0) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, messageName } = await ctx.params;
  const audit = auditDelete(session.user.email);

  const result = getDb()
    .prepare(
      `UPDATE mdm_message_text
       SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
           modify_status=@modify_status, version=version+1
       WHERE project_name=@project_name AND message_name=@message_name
         AND modify_status != 'deleted'`
    )
    .run({
      project_name: decodeURIComponent(projectName),
      message_name: decodeURIComponent(messageName),
      ...audit,
    });

  if (result.changes === 0) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  return Response.json({ ok: true });
}
