import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditUpdate, auditDelete, auditLock } from "@/lib/audit/audit";
import type { MonitorInput } from "@/types/monitor";

type Ctx = { params: Promise<{ projectName: string; monitorName: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, monitorName } = await ctx.params;
  const row = getDb().prepare(
    "SELECT * FROM mdm_monitor WHERE project_name = ? AND monitor_name = ?"
  ).get(projectName, monitorName);

  if (!row) return Response.json({ error: "Monitor nicht gefunden" }, { status: 404 });
  return Response.json(row);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, monitorName } = await ctx.params;
  const body: Partial<MonitorInput> & { action?: "lock" | "unlock" } = await request.json();
  const db = getDb();

  const existing = db.prepare(
    "SELECT modify_status FROM mdm_monitor WHERE project_name = ? AND monitor_name = ?"
  ).get(projectName, monitorName) as { modify_status: string } | undefined;

  if (!existing) return Response.json({ error: "Monitor nicht gefunden" }, { status: 404 });

  if (body.action === "lock") {
    const audit = auditLock(session.user.email);
    db.prepare(
      `UPDATE mdm_monitor
       SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
           modify_status=@modify_status, version=version+1
       WHERE project_name=@project_name AND monitor_name=@monitor_name`
    ).run({ ...audit, project_name: projectName, monitor_name: monitorName });
    return Response.json({ project_name: projectName, monitor_name: monitorName });
  }

  if (body.action === "unlock") {
    const audit = auditUpdate(session.user.email);
    db.prepare(
      `UPDATE mdm_monitor
       SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
           modify_status=@modify_status, version=version+1
       WHERE project_name=@project_name AND monitor_name=@monitor_name`
    ).run({ ...audit, project_name: projectName, monitor_name: monitorName });
    return Response.json({ project_name: projectName, monitor_name: monitorName });
  }

  if (!body.title?.trim())        return Response.json({ error: "Bezeichnung ist Pflichtfeld" }, { status: 400 });
  if (!body.monitor_name?.trim()) return Response.json({ error: "MonitorName ist Pflichtfeld" }, { status: 400 });

  const newMonitorName = body.monitor_name.trim();
  const audit = auditUpdate(session.user.email);

  const updateTx = db.transaction(() => {
    // Rename falls geändert — ON UPDATE CASCADE aktualisiert mdm_monitor_variable automatisch
    if (newMonitorName !== monitorName) {
      const nameExists = db.prepare(
        "SELECT 1 FROM mdm_monitor WHERE project_name = ? AND monitor_name = ? AND monitor_name != ?"
      ).get(projectName, newMonitorName, monitorName);
      if (nameExists) throw new Error("UNIQUE: MonitorName bereits vorhanden");

      db.prepare(
        "UPDATE mdm_monitor SET monitor_name = ? WHERE project_name = ? AND monitor_name = ?"
      ).run(newMonitorName, projectName, monitorName);
    }

    db.prepare(
      `UPDATE mdm_monitor SET
        title=@title, status=@status, type=@type,
        datablock=@datablock, request_url=@request_url, response_file=@response_file,
        short_description=@short_description, detail_json=@detail_json,
        modify_user=@modify_user, modify_timestamp=@modify_timestamp,
        modify_status=@modify_status, version=version+1
       WHERE project_name=@project_name AND monitor_name=@monitor_name`
    ).run({
      ...body,
      type: body.type?.trim() || null,
      datablock: body.datablock?.trim() || null,
      request_url: body.request_url?.trim() || null,
      response_file: body.response_file?.trim() || null,
      short_description: body.short_description?.trim() || null,
      detail_json: body.detail_json?.trim() || null,
      ...audit,
      project_name: projectName,
      monitor_name: newMonitorName,
    });
  });

  try {
    updateTx();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fehler beim Speichern";
    if (msg.includes("UNIQUE")) return Response.json({ error: "MonitorName bereits vorhanden" }, { status: 409 });
    return Response.json({ error: msg }, { status: 500 });
  }

  return Response.json({ project_name: projectName, monitor_name: newMonitorName });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName, monitorName } = await ctx.params;
  const existing = getDb().prepare(
    "SELECT modify_status FROM mdm_monitor WHERE project_name = ? AND monitor_name = ?"
  ).get(projectName, monitorName);

  if (!existing) return Response.json({ error: "Monitor nicht gefunden" }, { status: 404 });

  const audit = auditDelete(session.user.email);
  getDb().prepare(
    `UPDATE mdm_monitor
     SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
         modify_status=@modify_status, version=version+1
     WHERE project_name=@project_name AND monitor_name=@monitor_name`
  ).run({ ...audit, project_name: projectName, monitor_name: monitorName });

  return Response.json({ project_name: projectName, monitor_name: monitorName });
}
