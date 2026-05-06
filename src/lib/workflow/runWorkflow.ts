import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { getDb, nextMonitorPollId } from "@/lib/db/db";
import { sendMonitorAlertMail, type MonitorAlertMessage } from "@/lib/mail/mailer";

export interface WorkflowResult {
  polls: {
    project_name: string;
    monitor_name: string;
    imported: number;
    skipped: number;
    co_id?: number;
    error?: string;
  }[];
  sent: number;
  konstant: number;
  dispatch_errors: number;
}

export async function runWorkflow(): Promise<WorkflowResult> {
  const db = getDb();

  const setup = db.prepare(
    "SELECT name, dispatch_delta_time FROM mdm_setup WHERE modify_status != 'deleted' LIMIT 1"
  ).get() as { name: string; dispatch_delta_time: number } | undefined;
  const setupName = setup?.name ?? "default";
  const deltaSeconds = setup?.dispatch_delta_time ?? 3600;

  const monitors = db.prepare(`
    SELECT project_name, monitor_name, request_url, response_file
    FROM mdm_monitor
    WHERE request_url IS NOT NULL AND request_url != ''
      AND response_file IS NOT NULL AND response_file != ''
      AND status = 'active'
      AND modify_status != 'deleted'
  `).all() as {
    project_name: string; monitor_name: string; request_url: string; response_file: string;
  }[];

  const polls: WorkflowResult["polls"] = [];
  for (const monitor of monitors) {
    polls.push(await pollOneMonitor(db, setupName, monitor));
  }

  const { sent, konstant, dispatch_errors } = await dispatchEmails(db, deltaSeconds);
  return { polls, sent, konstant, dispatch_errors };
}

async function pollOneMonitor(
  db: ReturnType<typeof getDb>,
  setupName: string,
  monitor: { project_name: string; monitor_name: string; request_url: string; response_file: string }
): Promise<WorkflowResult["polls"][0]> {
  const { project_name, monitor_name, request_url, response_file } = monitor;
  const coId = nextMonitorPollId();
  const ts = new Date().toISOString();

  let responseText: string;
  try {
    const fetchRes = await fetch(request_url, { signal: AbortSignal.timeout(10_000) });
    if (!fetchRes.ok) {
      return { project_name, monitor_name, imported: 0, skipped: 0, error: `HTTP ${fetchRes.status}` };
    }
    responseText = await fetchRes.text();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Verbindungsfehler";
    return { project_name, monitor_name, imported: 0, skipped: 0, error: msg };
  }

  const filename = `${coId}_${setupName}_${project_name}_${response_file}`;
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, filename), responseText, "utf-8");

  const responseAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO wf_monitor_poll (co_id, project_name, monitor_name, status, response_at) VALUES (?, ?, ?, 'response', ?)"
  ).run(coId, project_name, monitor_name, responseAt);

  let values: Record<string, unknown>;
  try {
    const fixed = responseText.replace(/"([^"]+)"\s*\{/g, '"$1": {');
    const parsed = JSON.parse(fixed) as Record<string, unknown>;
    const outerKeys = Object.keys(parsed);
    const first = outerKeys.length === 1 ? parsed[outerKeys[0]] : null;
    values = (first && typeof first === "object" && !Array.isArray(first))
      ? (first as Record<string, unknown>)
      : parsed;
  } catch {
    db.prepare("UPDATE wf_monitor_poll SET status='error', error_message=? WHERE co_id=?")
      .run("Ungültiges JSON-Format", coId);
    return { project_name, monitor_name, imported: 0, skipped: 0, co_id: coId, error: "Ungültiges JSON" };
  }

  const varRows = db.prepare(
    `SELECT name, value_id, datablock, offset FROM mdm_monitor_variable
     WHERE project_name = ? AND monitor_name = ? AND modify_status != 'deleted' AND value_id IS NOT NULL`
  ).all(project_name, monitor_name) as {
    name: string; value_id: number; datablock: string | null; offset: string | null;
  }[];

  if (varRows.length === 0) {
    db.prepare("UPDATE wf_monitor_poll SET status='error', error_message=? WHERE co_id=?")
      .run("Keine Variablen mit value_id gefunden", coId);
    return { project_name, monitor_name, imported: 0, skipped: 0, co_id: coId, error: "Keine Variablen" };
  }

  const varInfoMap = new Map(varRows.map((r) => [r.name, r]));
  const insertTs = db.prepare(
    "INSERT INTO ts_monitor_value (ts, value_id, value, bit_value, co_id, status) VALUES (?, ?, ?, ?, ?, 'import')"
  );
  const insertAddr = db.prepare(
    "INSERT INTO ts_monitor_value_address (id, pos, trigger_bit, trigger_address) VALUES (?, ?, ?, ?)"
  );

  let imported = 0;
  let skipped = 0;

  db.transaction(() => {
    for (const [varName, val] of Object.entries(values)) {
      const info = varInfoMap.get(varName);
      if (!info) { skipped++; continue; }

      const num = typeof val === "number" ? val : parseFloat(String(val));
      const numOrNull = isNaN(num) ? null : num;
      const bv = toBitValue(numOrNull);

      const { lastInsertRowid } = insertTs.run(ts, info.value_id, numOrNull, bv, coId);

      if (bv !== null) {
        const tsId = Number(lastInsertRowid);
        for (const addr of buildAddresses(tsId, bv, info.datablock, info.offset)) {
          insertAddr.run(addr.id, addr.pos, addr.trigger_bit, addr.trigger_address);
        }
      }
      imported++;
    }
  })();

  const bitRows = db.prepare(
    "SELECT bit_value FROM ts_monitor_value WHERE co_id = ? ORDER BY value_id"
  ).all(coId) as { bit_value: string | null }[];
  const hashInput = bitRows.map((r) => r.bit_value ?? "").join("|");
  const hashValue = createHash("sha256").update(hashInput).digest("hex");

  db.prepare("UPDATE wf_monitor_poll SET status='import', import_at=?, hash_value=? WHERE co_id=?")
    .run(new Date().toISOString(), hashValue, coId);

  return { project_name, monitor_name, imported, skipped, co_id: coId };
}

async function dispatchEmails(
  db: ReturnType<typeof getDb>,
  deltaSeconds: number
): Promise<{ sent: number; konstant: number; dispatch_errors: number }> {
  const now = new Date().toISOString();

  const pollsToCheck = db.prepare(`
    SELECT co_id, project_name, monitor_name, hash_value
    FROM wf_monitor_poll WHERE status = 'import' ORDER BY co_id ASC
  `).all() as { co_id: number; project_name: string; monitor_name: string; hash_value: string | null }[];

  const getLastSentHash = db.prepare(`
    SELECT hash_value FROM wf_monitor_poll
    WHERE project_name = ? AND monitor_name = ? AND status = 'send'
    ORDER BY co_id DESC LIMIT 1
  `);
  const markTsKonstant = db.prepare(
    "UPDATE ts_monitor_value SET status='konstant', status_timestamp=? WHERE co_id=? AND status='import'"
  );
  const markPollKonstant = db.prepare("UPDATE wf_monitor_poll SET status='konstant' WHERE co_id=?");

  let konstant = 0;
  db.transaction(() => {
    for (const poll of pollsToCheck) {
      if (!poll.hash_value) continue;
      const last = getLastSentHash.get(poll.project_name, poll.monitor_name) as { hash_value: string | null } | undefined;
      if (last?.hash_value === poll.hash_value) {
        markTsKonstant.run(now, poll.co_id);
        markPollKonstant.run(poll.co_id);
        konstant++;
      }
    }
  })();

  const pending = db.prepare(`
    SELECT id, co_id, ts, value_id, value, bit_value
    FROM ts_monitor_value WHERE status = 'import' ORDER BY ts ASC
  `).all() as {
    id: number; co_id: number | null; ts: string;
    value_id: number; value: number | null; bit_value: string | null;
  }[];

  let sent = 0;
  let dispatch_errors = 0;
  const processedValueIds = new Set<number>();

  const getVarInfo   = db.prepare(`SELECT project_name, monitor_name, name FROM mdm_monitor_variable WHERE value_id = ? AND modify_status != 'deleted'`);
  const getLastSent  = db.prepare(`SELECT MAX(status_timestamp) AS last_ts FROM ts_monitor_value WHERE value_id = ? AND status = 'send'`);
  const getAddresses = db.prepare(`SELECT trigger_address FROM ts_monitor_value_address WHERE id = ? AND trigger_address IS NOT NULL`);
  const getMessages  = db.prepare(`SELECT message_name, message_class, message_text FROM mdm_message_text WHERE trigger_address = ? AND project_name = ? AND modify_status != 'deleted'`);
  const getEmails    = db.prepare(`SELECT email_address FROM mdm_project_email WHERE project_name = ? AND is_active = 1 AND modify_status != 'deleted'`);
  const markSent     = db.prepare(`UPDATE ts_monitor_value SET status='send', status_timestamp=? WHERE value_id=? AND status='import'`);

  for (const row of pending) {
    if (processedValueIds.has(row.value_id)) continue;

    if (!row.bit_value) {
      markSent.run(now, row.value_id);
      processedValueIds.add(row.value_id);
      continue;
    }

    const varInfo = getVarInfo.get(row.value_id) as { project_name: string; monitor_name: string; name: string } | undefined;
    if (!varInfo) {
      markSent.run(now, row.value_id);
      processedValueIds.add(row.value_id);
      continue;
    }

    const lastSent = getLastSent.get(row.value_id) as { last_ts: string | null };
    if (lastSent?.last_ts) {
      const secondsAgo = (Date.now() - new Date(lastSent.last_ts).getTime()) / 1_000;
      if (secondsAgo < deltaSeconds) {
        processedValueIds.add(row.value_id);
        continue;
      }
    }

    const addresses = getAddresses.all(row.id) as { trigger_address: string }[];
    const messages: MonitorAlertMessage[] = [];
    for (const addr of addresses) {
      const msgs = getMessages.all(addr.trigger_address, varInfo.project_name) as
        { message_name: string; message_class: string | null; message_text: string }[];
      msgs.forEach((m) => messages.push({ ...m, trigger_address: addr.trigger_address }));
    }

    if (messages.length === 0) {
      markSent.run(now, row.value_id);
      processedValueIds.add(row.value_id);
      continue;
    }

    const recipients = getEmails.all(varInfo.project_name) as { email_address: string }[];
    if (recipients.length === 0) {
      markSent.run(now, row.value_id);
      processedValueIds.add(row.value_id);
      continue;
    }

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
      console.error(`workflow-dispatch: Fehler value_id=${row.value_id}:`, e instanceof Error ? e.message : e);
      dispatch_errors++;
    }
  }

  db.prepare(`
    UPDATE wf_monitor_poll SET status='send'
    WHERE status='import'
    AND NOT EXISTS (SELECT 1 FROM ts_monitor_value WHERE co_id = wf_monitor_poll.co_id AND status='import')
  `).run();

  return { sent, konstant, dispatch_errors };
}

function toBitValue(value: number | null): string | null {
  if (value === null || value === 0) return null;
  const intVal = Math.round(value);
  if (intVal <= 0) return null;
  return intVal.toString(2).padStart(16, "0");
}

function buildAddresses(
  tsId: number,
  bitValue: string,
  datablock: string | null,
  offset: string | null
): { id: number; pos: number; trigger_bit: number; trigger_address: string | null }[] {
  const setBits: number[] = [];
  for (let i = 0; i < bitValue.length; i++) {
    if (bitValue[i] === "1") setBits.push(i);
  }
  setBits.sort((a, b) => a - b);

  const dotIdx = offset ? offset.lastIndexOf(".") : -1;
  const offsetBase = dotIdx > 0 ? offset!.substring(0, dotIdx) : offset;

  const numMatch = offsetBase ? offsetBase.match(/^(.*?)(\d+)$/) : null;
  const dbxPrefix = numMatch ? (numMatch[1] || "DBX") : "DBX";
  const highByte = numMatch ? `${dbxPrefix}${numMatch[2]}` : offsetBase;
  const lowByte  = numMatch ? `${dbxPrefix}${parseInt(numMatch[2]) + 1}` : offsetBase;

  return setBits.map((bit, i) => {
    let trigger_address: string | null = null;
    if (datablock) {
      if (bit < 8) {
        trigger_address = highByte ? `%${datablock}.${highByte}.${7 - bit}` : null;
      } else {
        trigger_address = lowByte ? `%${datablock}.${lowByte}.${15 - bit}` : null;
      }
    }
    return { id: tsId, pos: i + 1, trigger_bit: bit, trigger_address };
  });
}
