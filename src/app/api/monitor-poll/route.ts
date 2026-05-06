import { NextRequest } from "next/server";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { auth } from "@/lib/auth/auth";
import { getDb, nextMonitorPollId } from "@/lib/db/db";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body = await request.json() as { project_name?: string; monitor_name?: string };
  const projectName = body.project_name?.trim();
  const monitorName = body.monitor_name?.trim();

  if (!projectName) return Response.json({ error: "project_name fehlt" }, { status: 400 });
  if (!monitorName) return Response.json({ error: "monitor_name fehlt" }, { status: 400 });

  const db = getDb();

  const monitor = db.prepare(
    "SELECT request_url, response_file FROM mdm_monitor WHERE project_name = ? AND monitor_name = ? AND modify_status != 'deleted'"
  ).get(projectName, monitorName) as { request_url: string | null; response_file: string | null } | undefined;

  if (!monitor) return Response.json({ error: "Monitor nicht gefunden" }, { status: 404 });
  if (!monitor.request_url) return Response.json({ error: "Keine request_url konfiguriert" }, { status: 400 });
  if (!monitor.response_file) return Response.json({ error: "Kein response_file konfiguriert" }, { status: 400 });

  const setup = db.prepare(
    "SELECT name FROM mdm_setup WHERE modify_status != 'deleted' LIMIT 1"
  ).get() as { name: string } | undefined;
  const setupName = setup?.name ?? "default";

  const coId = nextMonitorPollId();
  const ts = new Date().toISOString();

  // Fetch from SPS
  let responseText: string;
  try {
    const fetchRes = await fetch(monitor.request_url, { signal: AbortSignal.timeout(10_000) });
    if (!fetchRes.ok) {
      return Response.json({ error: `SPS-Anfrage fehlgeschlagen: HTTP ${fetchRes.status}` }, { status: 502 });
    }
    responseText = await fetchRes.text();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Verbindungsfehler";
    return Response.json({ error: `SPS nicht erreichbar: ${msg}` }, { status: 502 });
  }

  // Save response to file
  const filename = `${coId}_${setupName}_${projectName}_${monitor.response_file}`;
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, filename), responseText, "utf-8");

  const responseAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO wf_monitor_poll (co_id, project_name, monitor_name, status, response_at) VALUES (?, ?, ?, 'response', ?)"
  ).run(coId, projectName, monitorName, responseAt);

  // Parse SPS JSON — Siemens format: outer key has no colon
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
    return Response.json({ error: "Ungültiges JSON-Format" }, { status: 400 });
  }

  const varRows = db.prepare(
    `SELECT name, value_id, datablock, offset FROM mdm_monitor_variable
     WHERE project_name = ? AND monitor_name = ? AND modify_status != 'deleted' AND value_id IS NOT NULL`
  ).all(projectName, monitorName) as {
    name: string; value_id: number; datablock: string | null; offset: string | null
  }[];

  if (varRows.length === 0) {
    db.prepare("UPDATE wf_monitor_poll SET status='error', error_message=? WHERE co_id=?")
      .run("Keine Variablen mit value_id gefunden", coId);
    return Response.json({ error: "Keine Variablen mit value_id für diesen Monitor gefunden" }, { status: 404 });
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

  // Compute SHA256 hash of all bit_values for this co_id
  const bitRows = db.prepare(
    "SELECT bit_value FROM ts_monitor_value WHERE co_id = ? ORDER BY value_id"
  ).all(coId) as { bit_value: string | null }[];
  const hashInput = bitRows.map((r) => r.bit_value ?? "").join("|");
  const hashValue = createHash("sha256").update(hashInput).digest("hex");

  const importAt = new Date().toISOString();
  db.prepare(
    "UPDATE wf_monitor_poll SET status='import', import_at=?, hash_value=? WHERE co_id=?"
  ).run(importAt, hashValue, coId);

  return Response.json({ imported, skipped, ts, co_id: coId, filename, hash_value: hashValue });
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
