import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectName = (formData.get("project_name") as string | null)?.trim();
  const monitorName = (formData.get("monitor_name") as string | null)?.trim();
  const tsRaw = (formData.get("ts") as string | null)?.trim();
  const coIdParam = (formData.get("co_id") as string | null)?.trim();

  if (!file)        return Response.json({ error: "Keine Datei" }, { status: 400 });
  if (!projectName) return Response.json({ error: "project_name fehlt" }, { status: 400 });
  if (!monitorName) return Response.json({ error: "monitor_name fehlt" }, { status: 400 });

  const ts = tsRaw ? new Date(tsRaw).toISOString() : new Date().toISOString();
  const coId = coIdParam || randomUUID();
  const now = new Date().toISOString();

  // Parse SPS JSON format — outer key has no colon: "MonitorName" { ... }
  const content = await file.text();
  let values: Record<string, unknown>;
  try {
    const fixed = content.replace(/"([^"]+)"\s*\{/g, '"$1": {');
    const parsed = JSON.parse(fixed) as Record<string, unknown>;
    const outerKeys = Object.keys(parsed);
    const first = outerKeys.length === 1 ? parsed[outerKeys[0]] : null;
    values = (first && typeof first === "object" && !Array.isArray(first))
      ? (first as Record<string, unknown>)
      : parsed;
  } catch {
    return Response.json({ error: "Ungültiges JSON-Format" }, { status: 400 });
  }

  const db = getDb();

  // Workflow-Header: upsert wf_monitor_poll
  db.prepare(`
    INSERT INTO wf_monitor_poll (co_id, project_name, monitor_name, status, import_at)
    VALUES (?, ?, ?, 'import', ?)
    ON CONFLICT(co_id) DO UPDATE SET status = 'import', import_at = excluded.import_at
  `).run(coId, projectName, monitorName, now);

  // Build varName → {value_id, datablock, offset} lookup for this monitor
  const varRows = db.prepare(
    `SELECT name, value_id, datablock, offset FROM mdm_monitor_variable
     WHERE project_name = ? AND monitor_name = ? AND modify_status != 'deleted' AND value_id IS NOT NULL`
  ).all(projectName, monitorName) as {
    name: string; value_id: number; datablock: string | null; offset: string | null
  }[];

  if (varRows.length === 0) {
    return Response.json({ error: "Keine Variablen mit value_id für diesen Monitor gefunden" }, { status: 404 });
  }

  const varInfoMap = new Map(varRows.map((r) => [r.name, r]));

  const insertTs   = db.prepare(
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

  return Response.json({ imported, skipped, ts, co_id: coId });
}

/** value=0 oder null → null; sonst 16-stellige Binärdarstellung (z.B. 10 → "0000000000001010") */
function toBitValue(value: number | null): string | null {
  if (value === null || value === 0) return null;
  const intVal = Math.round(value);
  if (intVal <= 0) return null;
  return intVal.toString(2).padStart(16, "0");
}

/**
 * 16-bit = Byte1 (bits 0-7) + Byte2 (bits 8-15).
 * Byte1 → offset+1, bit in address = trigger_bit (0-7)
 * Byte2 → offset unchanged, bit in address = trigger_bit - 8
 * Beispiel: offset="102.0" → Byte1 uses "103", Byte2 uses "102"
 *   trigger_bit=3  → "%DB31.103.3"
 *   trigger_bit=8  → "%DB31.102.0"
 */
function buildAddresses(
  tsId: number,
  bitValue: string,
  datablock: string | null,
  offset: string | null
): { id: number; pos: number; trigger_bit: number; trigger_address: string | null }[] {
  const setBits: number[] = [];
  for (let i = 0; i < bitValue.length; i++) {
    if (bitValue[i] === "1") {
      setBits.push(i); // left-to-right index = trigger_bit
    }
  }
  setBits.sort((a, b) => a - b); // aufsteigend: niedrigstes Bit → pos=1

  const dotIdx = offset ? offset.lastIndexOf(".") : -1;
  const offsetBase = dotIdx > 0 ? offset!.substring(0, dotIdx) : offset;

  // Split offsetBase into text prefix + trailing number so we can increment for Byte1
  const numMatch = offsetBase ? offsetBase.match(/^(.*?)(\d+)$/) : null;
  const offsetByte2 = numMatch ? `${numMatch[1]}${numMatch[2]}` : offsetBase;
  const offsetByte1 = numMatch ? `${numMatch[1]}${parseInt(numMatch[2]) + 1}` : offsetBase;

  return setBits.map((bit, i) => {
    let trigger_address: string | null = null;
    if (datablock) {
      if (bit < 8) {
        trigger_address = offsetByte1 ? `%${datablock}.${offsetByte1}.${bit}` : null;
      } else {
        trigger_address = offsetByte2 ? `%${datablock}.${offsetByte2}.${bit - 8}` : null;
      }
    }
    return { id: tsId, pos: i + 1, trigger_bit: bit, trigger_address };
  });
}
