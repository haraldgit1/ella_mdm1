import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditUpdate, auditDelete } from "@/lib/audit/audit";

type Ctx = { params: Promise<{ name: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { name } = await ctx.params;
  const row = getDb()
    .prepare("SELECT * FROM mdm_setup WHERE name = ? AND modify_status != 'deleted'")
    .get(decodeURIComponent(name));

  if (!row) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  return Response.json(row);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { name } = await ctx.params;
  const body: { action?: string; dispatch_delta_time?: number; start_workflow?: number; display_timezone?: string; aktiv_record_counts?: number; archive_hour?: number } = await request.json();

  if (body.action === "toggle_workflow") {
    const db = getDb();
    const decodedName = decodeURIComponent(name);
    const row = db.prepare(
      "SELECT workflow_enabled FROM mdm_setup WHERE name = ? AND modify_status != 'deleted'"
    ).get(decodedName) as { workflow_enabled: number } | undefined;
    if (!row) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
    const newVal = row.workflow_enabled ? 0 : 1;
    const audit = auditUpdate(session.user.email);
    db.prepare(
      "UPDATE mdm_setup SET workflow_enabled=?, modify_user=?, modify_timestamp=?, modify_status=?, version=version+1 WHERE name=?"
    ).run(newVal, audit.modify_user, audit.modify_timestamp, audit.modify_status, decodedName);
    return Response.json({ ok: true, workflow_enabled: newVal });
  }

  const audit = auditUpdate(session.user.email);

  const result = getDb().prepare(
    `UPDATE mdm_setup
     SET dispatch_delta_time=@dispatch_delta_time, start_workflow=@start_workflow,
         display_timezone=@display_timezone, aktiv_record_counts=@aktiv_record_counts,
         archive_hour=@archive_hour,
         modify_user=@modify_user, modify_timestamp=@modify_timestamp,
         modify_status=@modify_status, version=version+1
     WHERE name=@name AND modify_status != 'deleted'`
  ).run({
    name: decodeURIComponent(name),
    dispatch_delta_time: body.dispatch_delta_time,
    start_workflow: body.start_workflow,
    display_timezone: body.display_timezone?.trim() || "Europe/Vienna",
    aktiv_record_counts: body.aktiv_record_counts,
    archive_hour: body.archive_hour,
    ...audit,
  });

  if (result.changes === 0) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { name } = await ctx.params;
  const audit = auditDelete(session.user.email);

  const result = getDb().prepare(
    `UPDATE mdm_setup
     SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
         modify_status=@modify_status, version=version+1
     WHERE name=@name AND modify_status != 'deleted'`
  ).run({ ...audit, name: decodeURIComponent(name) });

  if (result.changes === 0) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  return Response.json({ ok: true });
}
