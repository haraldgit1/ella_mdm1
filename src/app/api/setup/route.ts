import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditInsert } from "@/lib/audit/audit";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const rows = getDb()
    .prepare("SELECT * FROM mdm_setup WHERE modify_status != 'deleted' ORDER BY name")
    .all();

  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body: { name?: string; dispatch_delta_time?: number; start_workflow?: number; display_timezone?: string; aktiv_record_counts?: number; archive_hour?: number } =
    await request.json();

  if (!body.name?.trim()) return Response.json({ error: "Name fehlt" }, { status: 400 });

  const audit = auditInsert(session.user.email);

  try {
    getDb().prepare(
      `INSERT INTO mdm_setup
        (name, dispatch_delta_time, start_workflow, display_timezone, aktiv_record_counts, archive_hour,
         create_user, create_timestamp, modify_user, modify_timestamp, modify_status, version)
       VALUES
        (@name, @dispatch_delta_time, @start_workflow, @display_timezone, @aktiv_record_counts, @archive_hour,
         @create_user, @create_timestamp, @modify_user, @modify_timestamp, @modify_status, @version)`
    ).run({
      name: body.name.trim(),
      dispatch_delta_time: body.dispatch_delta_time ?? 3600,
      start_workflow: body.start_workflow ?? 1000,
      display_timezone: body.display_timezone?.trim() || "Europe/Vienna",
      aktiv_record_counts: body.aktiv_record_counts ?? 100,
      archive_hour: body.archive_hour ?? 48,
      ...audit,
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fehler";
    if (msg.includes("UNIQUE")) return Response.json({ error: "Name bereits vorhanden" }, { status: 409 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
