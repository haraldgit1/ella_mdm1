import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditInsert } from "@/lib/audit/audit";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectName  = searchParams.get("project_name")  ?? "";
  const messageName  = searchParams.get("message_name")  ?? "";
  const messageText  = searchParams.get("message_text")  ?? "";
  const messageClass = searchParams.get("message_class") ?? "";

  const conditions: string[] = ["modify_status != 'deleted'"];
  const params: unknown[] = [];

  if (projectName)  { conditions.push("project_name LIKE ?");  params.push(`%${projectName}%`); }
  if (messageName)  { conditions.push("message_name LIKE ?");  params.push(`%${messageName}%`); }
  if (messageText)  { conditions.push("message_text LIKE ?");  params.push(`%${messageText}%`); }
  if (messageClass) { conditions.push("message_class LIKE ?"); params.push(`%${messageClass}%`); }

  const rows = getDb()
    .prepare(
      `SELECT project_name, message_name, id, message_text, message_class,
              trigger_tag, trigger_bit, trigger_address,
              hmi_acknowledgment_tag, hmi_acknowledgment_bit, hmi_acknowledgment_address,
              report, modify_status, version
       FROM mdm_message_text
       WHERE ${conditions.join(" AND ")}
       ORDER BY project_name, id`
    )
    .all(...params);

  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body = await request.json();

  if (!body.project_name?.trim()) return Response.json({ error: "ProjektName fehlt" }, { status: 400 });
  if (!body.message_name?.trim()) return Response.json({ error: "MessageName fehlt" }, { status: 400 });
  if (!body.message_text?.trim()) return Response.json({ error: "Meldungstext fehlt" }, { status: 400 });

  const db = getDb();
  const audit = auditInsert(session.user.email);

  // id = MAX(id) + 1 innerhalb des Projekts
  const { max_id } = db.prepare(
    "SELECT COALESCE(MAX(id), 0) AS max_id FROM mdm_message_text WHERE project_name = ?"
  ).get(body.project_name.trim()) as { max_id: number };

  try {
    db.prepare(
      `INSERT INTO mdm_message_text
        (project_name, message_name, id, message_text, message_class,
         trigger_tag, trigger_bit, trigger_address,
         hmi_acknowledgment_tag, hmi_acknowledgment_bit, hmi_acknowledgment_address,
         report,
         create_user, create_timestamp, modify_user, modify_timestamp, modify_status, version)
       VALUES
        (@project_name, @message_name, @id, @message_text, @message_class,
         @trigger_tag, @trigger_bit, @trigger_address,
         @hmi_acknowledgment_tag, @hmi_acknowledgment_bit, @hmi_acknowledgment_address,
         @report,
         @create_user, @create_timestamp, @modify_user, @modify_timestamp, @modify_status, @version)`
    ).run({
      project_name:               body.project_name.trim(),
      message_name:               body.message_name.trim(),
      id:                         max_id + 1,
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

    return Response.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fehler";
    if (msg.includes("UNIQUE"))   return Response.json({ error: "MessageName bereits vorhanden" }, { status: 409 });
    if (msg.includes("FOREIGN"))  return Response.json({ error: "ProjektName nicht gefunden" }, { status: 400 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
