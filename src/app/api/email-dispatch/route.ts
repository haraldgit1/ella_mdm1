import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { sendMonitorAlertMail, type MonitorAlertMessage } from "@/lib/mail/mailer";

const DEFAULT_DELTA_MINUTES = 60;

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { delta_minutes?: number };
  const deltaMinutes = Number(body.delta_minutes ?? DEFAULT_DELTA_MINUTES);

  const db = getDb();
  const now = new Date().toISOString();

  // Alle Messwerte mit status='import' — älteste zuerst
  const pending = db.prepare(`
    SELECT id, co_id, ts, value_id, value, bit_value
    FROM ts_monitor_value
    WHERE status = 'import'
    ORDER BY ts ASC
  `).all() as {
    id: number; co_id: string | null; ts: string;
    value_id: number; value: number | null; bit_value: string | null;
  }[];

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  // Pro value_id nur einmal pro Dispatch-Lauf verarbeiten
  const processedValueIds = new Set<number>();

  const getVarInfo = db.prepare(`
    SELECT project_name, monitor_name, name
    FROM mdm_monitor_variable
    WHERE value_id = ? AND modify_status != 'deleted'
  `);

  const getLastSent = db.prepare(`
    SELECT MAX(status_timestamp) AS last_ts
    FROM ts_monitor_value
    WHERE value_id = ? AND status = 'send'
  `);

  const getAddresses = db.prepare(`
    SELECT trigger_address
    FROM ts_monitor_value_address
    WHERE id = ? AND trigger_address IS NOT NULL
  `);

  const getMessages = db.prepare(`
    SELECT message_name, message_class, message_text
    FROM mdm_message_text
    WHERE trigger_address = ? AND project_name = ? AND modify_status != 'deleted'
  `);

  const getEmails = db.prepare(`
    SELECT email_address
    FROM mdm_project_email
    WHERE project_name = ? AND is_active = 1 AND modify_status != 'deleted'
  `);

  const markSent = db.prepare(`
    UPDATE ts_monitor_value
    SET status = 'send', status_timestamp = ?
    WHERE value_id = ? AND status = 'import'
  `);

  for (const row of pending) {
    // Innerhalb eines Dispatch-Laufs jede value_id nur einmal verarbeiten
    if (processedValueIds.has(row.value_id)) continue;

    // Kein bit_value → kein Meldungstext möglich → direkt auf 'send'
    if (!row.bit_value) {
      markSent.run(now, row.value_id);
      processedValueIds.add(row.value_id);
      skipped++;
      continue;
    }

    // Monitor-Variable ermitteln
    const varInfo = getVarInfo.get(row.value_id) as
      { project_name: string; monitor_name: string; name: string } | undefined;

    if (!varInfo) {
      markSent.run(now, row.value_id);
      processedValueIds.add(row.value_id);
      skipped++;
      continue;
    }

    // Delta-Time-Check: letzte erfolgreiche Sendung für diese value_id
    const lastSent = getLastSent.get(row.value_id) as { last_ts: string | null };
    if (lastSent?.last_ts) {
      const minutesAgo = (Date.now() - new Date(lastSent.last_ts).getTime()) / 60_000;
      if (minutesAgo < deltaMinutes) {
        // Noch zu früh — Datensatz bleibt 'import', nächster Lauf prüft erneut
        processedValueIds.add(row.value_id);
        skipped++;
        continue;
      }
    }

    // Meldungstexte über Bit-Adressen ermitteln
    const addresses = getAddresses.all(row.id) as { trigger_address: string }[];
    const messages: MonitorAlertMessage[] = [];

    for (const addr of addresses) {
      const msgs = getMessages.all(addr.trigger_address, varInfo.project_name) as
        { message_name: string; message_class: string | null; message_text: string }[];
      msgs.forEach((m) => messages.push({ ...m, trigger_address: addr.trigger_address }));
    }

    if (messages.length === 0) {
      // Keine Meldungstexte konfiguriert → überspringen ohne E-Mail
      markSent.run(now, row.value_id);
      processedValueIds.add(row.value_id);
      skipped++;
      continue;
    }

    // Empfänger ermitteln
    const recipients = getEmails.all(varInfo.project_name) as { email_address: string }[];

    if (recipients.length === 0) {
      markSent.run(now, row.value_id);
      processedValueIds.add(row.value_id);
      skipped++;
      continue;
    }

    // E-Mail senden
    try {
      await sendMonitorAlertMail({
        to: recipients.map((r) => r.email_address),
        projectName: varInfo.project_name,
        monitorName: varInfo.monitor_name,
        variableName: varInfo.name,
        ts: row.ts,
        messages,
      });

      markSent.run(now, row.value_id);
      processedValueIds.add(row.value_id);
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      console.error(`email-dispatch: Fehler beim Senden für value_id=${row.value_id}:`, msg);
      errors++;
      // Status bleibt 'import' → nächster Lauf versucht es erneut
    }
  }

  return Response.json({
    processed: pending.length,
    sent,
    skipped,
    errors,
    delta_minutes: deltaMinutes,
  });
}

/** Dispatch-Status: Zähler + ausstehende und zuletzt versendete Datensätze */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const db = getDb();

  const { pending } = db.prepare(
    "SELECT COUNT(*) AS pending FROM ts_monitor_value WHERE status = 'import'"
  ).get() as { pending: number };

  const { sent_24h } = db.prepare(`
    SELECT COUNT(*) AS sent_24h FROM ts_monitor_value
    WHERE status = 'send' AND status_timestamp >= datetime('now', '-24 hours')
  `).get() as { sent_24h: number };

  const pending_records = db.prepare(`
    SELECT tmv.id, tmv.ts, tmv.bit_value, tmv.co_id,
           mmv.project_name, mmv.monitor_name, mmv.name AS variable_name
    FROM ts_monitor_value tmv
    LEFT JOIN mdm_monitor_variable mmv ON mmv.value_id = tmv.value_id
    WHERE tmv.status = 'import'
    ORDER BY tmv.ts ASC
    LIMIT 50
  `).all();

  const recent_sent = db.prepare(`
    SELECT tmv.id, tmv.ts, tmv.status_timestamp, tmv.bit_value,
           mmv.project_name, mmv.monitor_name, mmv.name AS variable_name
    FROM ts_monitor_value tmv
    LEFT JOIN mdm_monitor_variable mmv ON mmv.value_id = tmv.value_id
    WHERE tmv.status = 'send' AND tmv.status_timestamp IS NOT NULL
    ORDER BY tmv.status_timestamp DESC
    LIMIT 20
  `).all();

  return Response.json({ pending, sent_24h, pending_records, recent_sent });
}
