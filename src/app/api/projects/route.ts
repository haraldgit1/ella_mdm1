import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditInsert } from "@/lib/audit/audit";
import type { ProjectInput } from "@/types/project";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectName    = searchParams.get("project_name") ?? "";
  const title          = searchParams.get("title") ?? "";
  const projectTypeCode = searchParams.get("project_type_code") ?? "";
  const city           = searchParams.get("city") ?? "";
  const modifyStatus   = searchParams.get("modify_status") ?? "";

  const conditions: string[] = ["modify_status != 'deleted'"];
  const params: (string | number | null)[] = [];

  if (projectName)    { conditions.push("project_name LIKE ?");    params.push(`%${projectName}%`); }
  if (title)          { conditions.push("title LIKE ?");           params.push(`%${title}%`); }
  if (projectTypeCode){ conditions.push("project_type_code = ?");  params.push(projectTypeCode); }
  if (city)           { conditions.push("city LIKE ?");            params.push(`%${city}%`); }
  if (modifyStatus && modifyStatus !== "deleted") {
    conditions.push("modify_status = ?");
    params.push(modifyStatus);
  }

  const rows = getDb()
    .prepare(
      `SELECT project_name, title, short_description, project_type_code,
              city, modify_status, version
       FROM mdm_project
       WHERE ${conditions.join(" AND ")}
       ORDER BY project_name`
    )
    .all(...params);

  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body: ProjectInput = await request.json();

  if (!body.project_name?.trim()) return Response.json({ error: "ProjektName ist Pflichtfeld" }, { status: 400 });
  if (!/^[A-Za-z0-9_-]+$/.test(body.project_name)) return Response.json({ error: "ProjektName darf nur Buchstaben (A-Z), Ziffern, Bindestrich und Unterstrich enthalten (keine Umlaute oder Sonderzeichen)" }, { status: 400 });
  if (!body.title?.trim())        return Response.json({ error: "Bezeichnung ist Pflichtfeld" }, { status: 400 });

  const audit = auditInsert(session.user.email);

  try {
    getDb().prepare(
      `INSERT INTO mdm_project (
        project_name, title, short_description, project_type_code,
        street, house_no, postal_code, city, country,
        primary_ip_address, secondary_ip_address,
        alarm_interval_sec, alarm_count_limit, technical_json,
        create_user, create_timestamp, modify_user, modify_timestamp, modify_status, version
      ) VALUES (
        @project_name, @title, @short_description, @project_type_code,
        @street, @house_no, @postal_code, @city, @country,
        @primary_ip_address, @secondary_ip_address,
        @alarm_interval_sec, @alarm_count_limit, @technical_json,
        @create_user, @create_timestamp, @modify_user, @modify_timestamp, @modify_status, @version
      )`
    ).run({ ...body, ...audit });

    return Response.json({ project_name: body.project_name }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fehler beim Speichern";
    if (msg.includes("UNIQUE")) return Response.json({ error: "ProjektName bereits vorhanden" }, { status: 409 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
