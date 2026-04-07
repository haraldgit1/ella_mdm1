import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditUpdate, auditDelete, auditLock } from "@/lib/audit/audit";
import type { ProjectInput } from "@/types/project";

type Ctx = { params: Promise<{ projectName: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName } = await ctx.params;
  const db = getDb();

  const row = db
    .prepare("SELECT * FROM mdm_project WHERE project_name = ?")
    .get(projectName);

  if (!row) return Response.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  return Response.json(row);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName } = await ctx.params;
  const body: Partial<ProjectInput> & { action?: "lock" } = await request.json();
  const db = getDb();

  const existing = db
    .prepare("SELECT modify_status FROM mdm_project WHERE project_name = ?")
    .get(projectName) as { modify_status: string } | undefined;

  if (!existing) return Response.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  if (existing.modify_status === "locked") {
    return Response.json({ error: "Projekt ist gesperrt" }, { status: 409 });
  }

  if (body.action === "lock") {
    const audit = auditLock(session.user.email);
    db.prepare(
      `UPDATE mdm_project SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
       modify_status=@modify_status WHERE project_name=@project_name`
    ).run({ ...audit, project_name: projectName });
    return Response.json({ project_name: projectName });
  }

  if (!body.title?.trim()) {
    return Response.json({ error: "Bezeichnung ist Pflichtfeld" }, { status: 400 });
  }

  const audit = auditUpdate(session.user.email);
  db.prepare(
    `UPDATE mdm_project SET
      title=@title, short_description=@short_description,
      project_type_code=@project_type_code,
      street=@street, house_no=@house_no, postal_code=@postal_code,
      city=@city, country=@country,
      primary_ip_address=@primary_ip_address, secondary_ip_address=@secondary_ip_address,
      alarm_interval_sec=@alarm_interval_sec, alarm_count_limit=@alarm_count_limit,
      technical_json=@technical_json,
      modify_user=@modify_user, modify_timestamp=@modify_timestamp, modify_status=@modify_status
     WHERE project_name=@project_name`
  ).run({ ...body, ...audit, project_name: projectName });

  return Response.json({ project_name: projectName });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName } = await ctx.params;
  const db = getDb();

  const existing = db
    .prepare("SELECT modify_status FROM mdm_project WHERE project_name = ?")
    .get(projectName) as { modify_status: string } | undefined;

  if (!existing) return Response.json({ error: "Projekt nicht gefunden" }, { status: 404 });

  const audit = auditDelete(session.user.email);
  db.prepare(
    `UPDATE mdm_project SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
     modify_status=@modify_status WHERE project_name=@project_name`
  ).run({ ...audit, project_name: projectName });

  return Response.json({ project_name: projectName });
}
