import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { sendMonitorAlertMail, type MonitorAlertMessage } from "@/lib/mail/mailer";

const FALLBACK_DELTA_SECONDS = 3600;

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { delta_seconds?: number };
  const db = getDb();

  const setup = db.prepare(
    "SELECT dispatch_delta_time FROM mdm_setup WHERE modify_status != 'deleted' ORDER BY name LIMIT 1"
  ).get() as { dispatch_delta_time: number } | undefined;

  const deltaSeconds = Number(body.delta_seconds ?? setup?.dispatch_delta_time ?? FALLBACK_DELTA_SECONDS);
  const now = new Date().toISOString();

  // Pre-pass: hash-basierter Dedup — unveränderte Polling-Zyklen sofort auf 'konstant' setzen
  const pollsToCheck = db.prepare(`
    SELECT co_id, project_name, monitor_name, hash_value
    FROM wf_monitor_poll
    WHERE status = 'import'
    ORDER BY co_id ASC
  `).all() as { co_id: number; project_name: string; monitor_name: string; hash_value: string | null }[];

  const getLastSentHashStmt = db.prepare(`
    SELECT hash_value FROM wf_monitor_poll
    WHERE project_name = ? AND monitor_name = ? AND status = 'send'
    ORDER BY co_id DESC LIMIT 1
  `);
  const markTsKonstantStmt = db.prepare(
    "UPDATE ts_monitor_value SET status = 'konstant', status_timestamp = ? WHERE co_id = ? AND status = 'import'"
  );
  const markPollKonstantStmt = db.prepare(
    "UPDATE wf_monitor_poll SET status = 'konstant' WHERE co_id = ?"
  );

  let konstant = 0;
  db.transaction(() => {
    for (const poll of pollsToCheck) {
      if (!poll.hash_value) continue;
      const last = getLastSentHashStmt.get(poll.project_name, poll.monitor_name) as { hash_value: string | null } | undefined;
      if (last?.hash_value && last.hash_value === poll.hash_value) {
        markTsKonstantStmt.run(now, poll.co_id);
        markPollKonstantStmt.run(poll.co_id);
        konstant++;
      }
    }
  })();

  // Alle verbleibenden Messwerte mit status='import' — älteste zuerst
  const pending = db.prepare(`
    SELECT id, co_id, ts, value_id, value, bit_value
    FROM ts_monitor_value
    WHERE status = 'import'
    ORDER BY ts ASC
  `).all() as {
    id: number; co_id: number | null; ts: string;
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
      const secondsAgo = (Date.now() - new Date(lastSent.last_ts).getTime()) / 1_000;
      if (secondsAgo < deltaSeconds) {
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
        coId: row.co_id ?? undefined,
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

  // wf_monitor_poll auf 'send' setzen, wenn alle Messwerte des Zyklus verarbeitet sind
  db.prepare(`
    UPDATE wf_monitor_poll SET status = 'send'
    WHERE status = 'import'
    AND NOT EXISTS (
      SELECT 1 FROM ts_monitor_value WHERE co_id = wf_monitor_poll.co_id AND status = 'import'
    )
  `).run();

  return Response.json({
    processed: pending.length,
    sent,
    skipped,
    konstant,
    errors,
    delta_seconds: deltaSeconds,
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
    SELECT tmv.id, tmv.ts, tmv.status_timestamp, tmv.status, tmv.co_id,
           mmv.project_name, mmv.monitor_name, mmv.name AS variable_name
    FROM ts_monitor_value tmv
    LEFT JOIN mdm_monitor_variable mmv ON mmv.value_id = tmv.value_id
    WHERE tmv.status IN ('send', 'konstant') AND tmv.status_timestamp IS NOT NULL
    ORDER BY tmv.status_timestamp DESC
    LIMIT 20
  `).all();

  const wf_poll_recent = db.prepare(`
    SELECT co_id, project_name, monitor_name, polled_at, status, hash_value
    FROM wf_monitor_poll
    ORDER BY co_id DESC
    LIMIT 100
  `).all();

  const setup = db.prepare(
    "SELECT dispatch_delta_time, display_timezone FROM mdm_setup WHERE modify_status != 'deleted' ORDER BY name LIMIT 1"
  ).get() as { dispatch_delta_time: number; display_timezone: string } | undefined;
  const default_delta_seconds = setup?.dispatch_delta_time ?? 3600;
  const display_timezone = setup?.display_timezone ?? "Europe/Vienna";

  return Response.json({ pending, sent_24h, pending_records, recent_sent, wf_poll_recent, default_delta_seconds, display_timezone });
}

/** Löscht Bewegungsdaten: alle (all=true) oder selektiv per co_id */
export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { all?: boolean; co_id?: unknown; cleanup?: boolean };
  const db = getDb();

  if (body.cleanup === true) {
    const setup = db.prepare(
      "SELECT aktiv_record_counts FROM mdm_setup WHERE modify_status != 'deleted' LIMIT 1"
    ).get() as { aktiv_record_counts: number } | undefined;
    const keepCount = setup?.aktiv_record_counts ?? 100;

    const maxRow = db.prepare("SELECT MAX(co_id) AS max FROM wf_monitor_poll").get() as { max: number | null };
    const maxCoId = maxRow?.max ?? 0;
    const threshold = maxCoId - keepCount;

    if (threshold <= 0) {
      return Response.json({ deleted_polls: 0, deleted_values: 0, deleted_addresses: 0, threshold: 0, message: "Nichts zu löschen" });
    }

    const result = db.transaction(() => {
      const { changes: addr } = db.prepare(
        "DELETE FROM ts_monitor_value_address WHERE id IN (SELECT id FROM ts_monitor_value WHERE co_id < ?)"
      ).run(threshold);
      const { changes: val } = db.prepare(
        "DELETE FROM ts_monitor_value WHERE co_id < ?"
      ).run(threshold);
      const { changes: poll } = db.prepare(
        "DELETE FROM wf_monitor_poll WHERE co_id < ?"
      ).run(threshold);
      return { deleted_addresses: addr, deleted_values: val, deleted_polls: poll };
    })();

    return Response.json({ ...result, threshold, max_co_id: maxCoId, keep_count: keepCount });
  }

  if (body.all === true) {
    const result = db.transaction(() => {
      const { changes: addr } = db.prepare("DELETE FROM ts_monitor_value_address").run();
      const { changes: val }  = db.prepare("DELETE FROM ts_monitor_value").run();
      const { changes: poll } = db.prepare("DELETE FROM wf_monitor_poll").run();
      return { deleted_addresses: addr, deleted_values: val, deleted_polls: poll };
    })();
    return Response.json(result);
  }

  const coId = Number(body.co_id);
  if (!coId || isNaN(coId)) {
    return Response.json({ error: "co_id fehlt oder ungültig" }, { status: 400 });
  }

  const result = db.transaction(() => {
    const { changes: addr } = db.prepare(
      "DELETE FROM ts_monitor_value_address WHERE id IN (SELECT id FROM ts_monitor_value WHERE co_id = ?)"
    ).run(coId);
    const { changes: val }  = db.prepare("DELETE FROM ts_monitor_value WHERE co_id = ?").run(coId);
    const { changes: poll } = db.prepare("DELETE FROM wf_monitor_poll WHERE co_id = ?").run(coId);
    return { deleted_addresses: addr, deleted_values: val, deleted_polls: poll };
  })();

  return Response.json(result);
}
