import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditUpdate, auditDelete } from "@/lib/audit/audit";

type Ctx = { params: Promise<{ projectName: string; monitorName: string; name: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, monitorName, name } = await ctx.params;
  const body: { title?: string; datablock?: string; data_type?: string; offset?: string } = await request.json();

  if (!body.data_type?.trim()) return Response.json({ error: "DataType ist Pflichtfeld" }, { status: 400 });

  const existing = getDb().prepare(
    "SELECT modify_status FROM mdm_monitor_variable WHERE project_name = ? AND monitor_name = ? AND name = ?"
  ).get(projectName, monitorName, name);

  if (!existing) return Response.json({ error: "Variable nicht gefunden" }, { status: 404 });

  const audit = auditUpdate(session.user.email);
  getDb().prepare(
    `UPDATE mdm_monitor_variable SET
       title=@title, datablock=@datablock, data_type=@data_type, offset=@offset,
       modify_user=@modify_user, modify_timestamp=@modify_timestamp,
       modify_status=@modify_status, version=version+1
     WHERE project_name=@project_name AND monitor_name=@monitor_name AND name=@name`
  ).run({
    title: body.title,
    datablock: body.datablock?.trim() || null,
    data_type: body.data_type,
    offset: body.offset?.trim() || null,
    ...audit,
    project_name: projectName,
    monitor_name: monitorName,
    name,
  });

  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, monitorName, name } = await ctx.params;
  const existing = getDb().prepare(
    "SELECT modify_status FROM mdm_monitor_variable WHERE project_name = ? AND monitor_name = ? AND name = ?"
  ).get(projectName, monitorName, name);

  if (!existing) return Response.json({ error: "Variable nicht gefunden" }, { status: 404 });

  const audit = auditDelete(session.user.email);
  getDb().prepare(
    `UPDATE mdm_monitor_variable
     SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
         modify_status=@modify_status, version=version+1
     WHERE project_name=@project_name AND monitor_name=@monitor_name AND name=@name`
  ).run({ ...audit, project_name: projectName, monitor_name: monitorName, name });

  return Response.json({ ok: true });
}
