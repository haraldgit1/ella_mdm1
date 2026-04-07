import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditUpdate, auditDelete, auditLock } from "@/lib/audit/audit";
import type { DeviceInput } from "@/types/device";

type Ctx = { params: Promise<{ projectName: string; deviceName: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, deviceName } = await ctx.params;
  const db = getDb();

  const row = db.prepare(
    "SELECT * FROM mdm_device WHERE project_name = ? AND device_name = ?"
  ).get(projectName, deviceName);

  if (!row) return Response.json({ error: "Device nicht gefunden" }, { status: 404 });
  return Response.json(row);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, deviceName } = await ctx.params;
  const body: Partial<DeviceInput> & { action?: "lock" } = await request.json();
  const db = getDb();

  const existing = db.prepare(
    "SELECT modify_status FROM mdm_device WHERE project_name = ? AND device_name = ?"
  ).get(projectName, deviceName) as { modify_status: string } | undefined;

  if (!existing) return Response.json({ error: "Device nicht gefunden" }, { status: 404 });
  if (existing.modify_status === "locked") return Response.json({ error: "Device ist gesperrt" }, { status: 409 });

  if (body.action === "lock") {
    const audit = auditLock(session.user.email);
    db.prepare(
      `UPDATE mdm_device SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
       modify_status=@modify_status WHERE project_name=@project_name AND device_name=@device_name`
    ).run({ ...audit, project_name: projectName, device_name: deviceName });
    return Response.json({ project_name: projectName, device_name: deviceName });
  }

  if (!body.title?.trim())        return Response.json({ error: "Bezeichnung ist Pflichtfeld" }, { status: 400 });
  if (!body.device_type_code?.trim()) return Response.json({ error: "Typ ist Pflichtfeld" }, { status: 400 });

  if (body.limit_min_value !== undefined && body.limit_max_value !== undefined) {
    if (body.limit_min_value > body.limit_max_value) {
      return Response.json({ error: "Limit-Min muss ≤ Limit-Max sein" }, { status: 400 });
    }
  }

  const audit = auditUpdate(session.user.email);
  db.prepare(
    `UPDATE mdm_device SET
      title=@title, device_type_code=@device_type_code, status=@status,
      short_description_json=@short_description_json,
      limit_min_value=@limit_min_value, limit_max_value=@limit_max_value,
      alarm_enabled=@alarm_enabled, alarm_timestamp=@alarm_timestamp, alarm_level_code=@alarm_level_code,
      detail_json=@detail_json,
      modify_user=@modify_user, modify_timestamp=@modify_timestamp, modify_status=@modify_status
     WHERE project_name=@project_name AND device_name=@device_name`
  ).run({ ...body, ...audit, project_name: projectName, device_name: deviceName });

  return Response.json({ project_name: projectName, device_name: deviceName });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, deviceName } = await ctx.params;
  const db = getDb();

  const existing = db.prepare(
    "SELECT modify_status FROM mdm_device WHERE project_name = ? AND device_name = ?"
  ).get(projectName, deviceName);

  if (!existing) return Response.json({ error: "Device nicht gefunden" }, { status: 404 });

  const audit = auditDelete(session.user.email);
  db.prepare(
    `UPDATE mdm_device SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
     modify_status=@modify_status WHERE project_name=@project_name AND device_name=@device_name`
  ).run({ ...audit, project_name: projectName, device_name: deviceName });

  return Response.json({ project_name: projectName, device_name: deviceName });
}
