import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditInsert } from "@/lib/audit/audit";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const projectName = new URL(request.url).searchParams.get("projectName");
  if (!projectName) return Response.json({ error: "projectName fehlt" }, { status: 400 });

  const rows = getDb()
    .prepare(
      `SELECT email_address, email_purpose, is_active
       FROM mdm_project_email
       WHERE project_name = ? AND modify_status != 'deleted'
       ORDER BY email_address`
    )
    .all(projectName);

  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body: { project_name: string; email_address: string; email_purpose?: string; is_active?: number } =
    await request.json();

  if (!body.project_name?.trim())  return Response.json({ error: "ProjektName fehlt" }, { status: 400 });
  if (!body.email_address?.trim()) return Response.json({ error: "E-Mail-Adresse fehlt" }, { status: 400 });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email_address)) {
    return Response.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }

  const audit = auditInsert(session.user.email);

  try {
    getDb().prepare(
      `INSERT INTO mdm_project_email
        (project_name, email_address, email_purpose, is_active,
         create_user, create_timestamp, modify_user, modify_timestamp, modify_status)
       VALUES
        (@project_name, @email_address, @email_purpose, @is_active,
         @create_user, @create_timestamp, @modify_user, @modify_timestamp, @modify_status)`
    ).run({ email_purpose: null, is_active: 1, ...body, ...audit });

    return Response.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fehler";
    if (msg.includes("UNIQUE")) return Response.json({ error: "E-Mail bereits vorhanden" }, { status: 409 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
