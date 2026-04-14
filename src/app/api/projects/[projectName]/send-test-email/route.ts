import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { sendAlarmTestMail } from "@/lib/mail/mailer";

type Ctx = { params: Promise<{ projectName: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { projectName } = await params;
  const db = getDb();

  // Projektdaten laden
  const project = db.prepare(
    "SELECT project_name, title FROM mdm_project WHERE project_name = ? AND modify_status != 'deleted'"
  ).get(decodeURIComponent(projectName)) as { project_name: string; title: string } | undefined;

  if (!project) return Response.json({ error: "Projekt nicht gefunden" }, { status: 404 });

  // Alarmstufen laden
  const alarms = db.prepare(
    `SELECT alarm_level_code, alarm_text, severity_rank
     FROM mdm_project_alarm
     WHERE project_name = ? AND modify_status != 'deleted'
     ORDER BY severity_rank`
  ).all(project.project_name) as { alarm_level_code: string; alarm_text: string; severity_rank: number | null }[];

  if (alarms.length === 0)
    return Response.json({ error: "Keine Alarmstufen konfiguriert" }, { status: 400 });

  // Aktive Empfänger laden
  const recipients = db.prepare(
    `SELECT email_address FROM mdm_project_email
     WHERE project_name = ? AND is_active = 1 AND modify_status != 'deleted'`
  ).all(project.project_name) as { email_address: string }[];

  if (recipients.length === 0)
    return Response.json({ error: "Keine aktiven Ziel-E-Mail-Adressen konfiguriert" }, { status: 400 });

  try {
    const result = await sendAlarmTestMail({
      to: recipients.map((r) => r.email_address),
      projectName: project.project_name,
      projectTitle: project.title,
      alarms,
    });

    return Response.json({
      ok: true,
      sent_to: recipients.map((r) => r.email_address),
      alarms: alarms.length,
      messageId: result.messageId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler beim E-Mail-Versand";
    return Response.json({ error: msg }, { status: 500 });
  }
}
