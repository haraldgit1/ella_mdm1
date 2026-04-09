import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditUpdate, auditDelete } from "@/lib/audit/audit";

type Ctx = { params: Promise<{ projectName: string; deviceName: string; name: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, deviceName, name } = await ctx.params;
  const body: { title: string; data_type: string; offset?: string; range?: string; unit?: string; detail_json?: string } =
    await request.json();

  if (!body.title?.trim())     return Response.json({ error: "Bezeichnung fehlt" }, { status: 400 });
  if (!body.data_type?.trim()) return Response.json({ error: "DataType fehlt" }, { status: 400 });

  const audit = auditUpdate(session.user.email);
  const result = getDb().prepare(
    `UPDATE mdm_device_variable
     SET title=@title, data_type=@data_type,
         offset=@offset, range=@range, unit=@unit, detail_json=@detail_json,
         modify_user=@modify_user, modify_timestamp=@modify_timestamp,
         modify_status=@modify_status, version=version+1
     WHERE project_name=@project_name AND device_name=@device_name AND name=@name
       AND modify_status != 'deleted'`
  ).run({
    title: body.title,
    data_type: body.data_type,
    offset: body.offset?.trim() || null,
    range: body.range?.trim() || null,
    unit: body.unit?.trim() || null,
    detail_json: body.detail_json?.trim() || null,
    ...audit,
    project_name: decodeURIComponent(projectName),
    device_name: decodeURIComponent(deviceName),
    name: decodeURIComponent(name),
  });

  if (result.changes === 0) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, deviceName, name } = await ctx.params;
  const audit = auditDelete(session.user.email);

  const result = getDb().prepare(
    `UPDATE mdm_device_variable
     SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
         modify_status=@modify_status, version=version+1
     WHERE project_name=@project_name AND device_name=@device_name AND name=@name
       AND modify_status != 'deleted'`
  ).run({
    ...audit,
    project_name: decodeURIComponent(projectName),
    device_name: decodeURIComponent(deviceName),
    name: decodeURIComponent(name),
  });

  if (result.changes === 0) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  return Response.json({ ok: true });
}
