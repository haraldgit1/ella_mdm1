import { getDb } from "@/lib/db/db";
import { runWorkflow } from "@/lib/workflow/runWorkflow";

let loopStarted = false;
let prevEnabled: boolean | null = null;
let runCount = 0;

export function startWorkflowLoop() {
  if (loopStarted) return;
  loopStarted = true;
  setTimeout(loop, 2000);
}

async function loop(): Promise<void> {
  const db = getDb();
  const setup = db
    .prepare("SELECT start_workflow, display_timezone, workflow_enabled, aktiv_record_counts FROM mdm_setup WHERE modify_status != 'deleted' LIMIT 1")
    .get() as { start_workflow: number; display_timezone: string; workflow_enabled: number; aktiv_record_counts: number } | undefined;

  const intervalMs = setup?.start_workflow ?? 1000;
  const tz = setup?.display_timezone ?? "Europe/Vienna";
  const enabled = (setup?.workflow_enabled ?? 1) !== 0;

  if (!enabled) {
    if (prevEnabled !== false) console.log("[workflow] gestoppt");
    prevEnabled = false;
    setTimeout(loop, intervalMs);
    return;
  }

  if (prevEnabled === false) console.log("[workflow] gestartet");
  prevEnabled = true;

  try {
    const result = await runWorkflow();
    runCount++;

    const totalImported = result.polls.reduce((s, p) => s + p.imported, 0);
    const pollErrors = result.polls.filter((p) => p.error).length;
    if (totalImported > 0 || result.sent > 0 || pollErrors > 0) {
      const localTs = new Date().toLocaleString("de-DE", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
      const coIds = result.polls.filter((p) => p.co_id != null).map((p) => p.co_id).join(",");
      console.log(
        `[workflow] ${localTs} co_id=${coIds || "—"}` +
        ` imported=${totalImported} sent=${result.sent} konstant=${result.konstant}` +
        (pollErrors > 0 ? ` poll_errors=${pollErrors}` : "") +
        (result.dispatch_errors > 0 ? ` dispatch_errors=${result.dispatch_errors}` : "")
      );
    }

    // Auto-Cleanup alle 100 Läufe
    if (runCount % 100 === 0) {
      autoCleanup(db, setup?.aktiv_record_counts ?? 100, tz);
    }
  } catch (e) {
    console.error("[workflow] Unerwarteter Fehler:", e instanceof Error ? e.message : e);
  } finally {
    setTimeout(loop, intervalMs);
  }
}

function autoCleanup(db: ReturnType<typeof getDb>, keepCount: number, tz: string) {
  const range = db.prepare(
    "SELECT MAX(co_id) AS max_id, MIN(co_id) AS min_id FROM wf_monitor_poll"
  ).get() as { max_id: number | null; min_id: number | null };

  const diff = (range?.max_id ?? 0) - (range?.min_id ?? 0);
  if (diff <= keepCount) return;

  const threshold = (range!.max_id!) - keepCount;

  db.transaction(() => {
    db.prepare("DELETE FROM ts_monitor_value_address WHERE id IN (SELECT id FROM ts_monitor_value WHERE co_id < ?)").run(threshold);
    db.prepare("DELETE FROM ts_monitor_value WHERE co_id < ?").run(threshold);
    db.prepare("DELETE FROM wf_monitor_poll WHERE co_id < ?").run(threshold);
  })();

  const localTs = new Date().toLocaleString("de-DE", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  console.log(`[workflow-cleanup] ${localTs} diff=${diff} > keep=${keepCount} → co_id < ${threshold} gelöscht`);
}
