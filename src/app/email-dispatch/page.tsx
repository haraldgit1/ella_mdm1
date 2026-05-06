"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

interface PendingRecord {
  id: number;
  ts: string;
  bit_value: string | null;
  co_id: number | null;
  project_name: string | null;
  monitor_name: string | null;
  variable_name: string | null;
}

interface SentRecord {
  id: number;
  ts: string;
  status_timestamp: string;
  status: string;
  co_id: number | null;
  project_name: string | null;
  monitor_name: string | null;
  variable_name: string | null;
}

interface PollRecord {
  co_id: number;
  project_name: string;
  monitor_name: string;
  polled_at: string;
  status: string;
  hash_value: string | null;
}

interface Stats {
  pending: number;
  sent_24h: number;
  pending_records: PendingRecord[];
  recent_sent: SentRecord[];
  wf_poll_recent: PollRecord[];
  default_delta_seconds: number;
  display_timezone: string;
}

interface DispatchResult {
  processed: number;
  sent: number;
  skipped: number;
  konstant: number;
  errors: number;
  delta_seconds: number;
}

function fmtTs(ts: string, tz: string): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts.includes("T") && !ts.endsWith("Z") ? ts + "Z" : ts);
    return d.toLocaleString("de-DE", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return ts.replace("T", " ").slice(0, 19);
  }
}

export default function EmailDispatchPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ deleted_polls: number; deleted_values: number; threshold: number; message?: string } | null>(null);
  const [deltaSeconds, setDeltaSeconds] = useState(3600);
  const [deltaInitialized, setDeltaInitialized] = useState(false);
  const [lastResult, setLastResult] = useState<DispatchResult | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-dispatch");
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) loadStats();
  }, [session, loadStats]);

  useEffect(() => {
    if (stats && !deltaInitialized) {
      setDeltaSeconds(stats.default_delta_seconds ?? 3600);
      setDeltaInitialized(true);
    }
  }, [stats, deltaInitialized]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Laden…</p>
      </div>
    );
  }

  if (!session) {
    router.replace("/login");
    return null;
  }

  async function handleDispatch() {
    setDispatching(true);
    setDispatchError(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/email-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta_seconds: deltaSeconds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDispatchError(data.error ?? "Fehler beim Dispatch");
      } else {
        setLastResult(data as DispatchResult);
        await loadStats();
      }
    } catch {
      setDispatchError("Netzwerkfehler");
    } finally {
      setDispatching(false);
    }
  }

  async function handleDelete(coId: number) {
    if (!window.confirm(`Alle Messwerte für co_id=${coId} löschen?`)) return;
    try {
      const res = await fetch("/api/email-dispatch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ co_id: coId }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error ?? "Fehler beim Löschen");
      else await loadStats();
    } catch {
      alert("Netzwerkfehler");
    }
  }

  async function handleCleanup() {
    if (!window.confirm("Alte Bewegungsdaten löschen?\nEs werden alle Datensätze gelöscht, deren co_id kleiner ist als (max_co_id - aktiv_record_counts).")) return;
    setCleaning(true);
    setCleanResult(null);
    try {
      const res = await fetch("/api/email-dispatch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleanup: true }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error ?? "Fehler beim Bereinigen");
      else { setCleanResult(data); await loadStats(); }
    } catch {
      alert("Netzwerkfehler");
    } finally {
      setCleaning(false);
    }
  }

  async function handleDeleteAll() {
    const total = (stats?.pending ?? 0) + (stats?.wf_poll_recent.length ?? 0);
    if (!window.confirm(`Alle Bewegungsdaten löschen (ts_monitor_value, ts_monitor_value_address, wf_monitor_poll)?\nDieser Vorgang kann nicht rückgängig gemacht werden.`)) return;
    try {
      const res = await fetch("/api/email-dispatch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error ?? "Fehler beim Löschen");
      else await loadStats();
    } catch {
      alert("Netzwerkfehler");
    }
  }

  const hasPending = (stats?.pending ?? 0) > 0;
  const tz = stats?.display_timezone ?? "Europe/Vienna";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-2 text-sm text-blue-600 hover:underline block"
            >
              ← Zurück
            </button>
            <h1 className="text-2xl font-bold text-gray-900">E-Mail Dispatch</h1>
            <p className="text-sm text-gray-500 mt-1">
              Verarbeitung von SPS-Meldungen und automatischer E-Mail-Versand
            </p>
          </div>
          <button
            onClick={loadStats}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 mt-6"
          >
            {loading ? "Laden…" : "Aktualisieren"}
          </button>
        </div>

        {/* Status-Karten */}
        <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-3">
          <div className={`rounded-xl border bg-white p-5 shadow-sm ${hasPending ? "border-red-300" : "border-gray-200"}`}>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ausstehend</p>
            <p className={`text-3xl font-bold ${hasPending ? "text-red-600" : "text-gray-700"}`}>
              {stats?.pending ?? "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1">status = import</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Versendet (24 h)</p>
            <p className="text-3xl font-bold text-green-600">{stats?.sent_24h ?? "—"}</p>
            <p className="text-xs text-gray-400 mt-1">E-Mails erfolgreich</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Delta-Time</p>
            <p className="text-3xl font-bold text-blue-600">{deltaSeconds}</p>
            <p className="text-xs text-gray-400 mt-1">Sekunden Mindestabstand</p>
          </div>
        </div>

        {/* Dispatch-Aktion */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Dispatch ausführen</h2>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Delta-Time (Sek)
              <input
                type="number"
                min={0}
                value={deltaSeconds}
                onChange={(e) => setDeltaSeconds(Number(e.target.value))}
                className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={handleDispatch}
              disabled={dispatching}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {dispatching ? "Wird verarbeitet…" : "Jetzt versenden"}
            </button>
          </div>

          {lastResult && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <strong>
                {lastResult.sent} E-Mail{lastResult.sent !== 1 ? "s" : ""} versendet
              </strong>
              {" — "}
              {lastResult.skipped} übersprungen, {lastResult.errors} Fehler
              {" "}(gesamt {lastResult.processed} Datensätze, Delta-Time {lastResult.delta_seconds} Sek)
            </div>
          )}
          {lastResult && lastResult.konstant > 0 && (
            <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Info: {lastResult.konstant} Polling-Zyklus{lastResult.konstant !== 1 ? "en" : ""} ohne Änderung — Hash-Wert identisch mit letztem Versand, keine E-Mail erforderlich.
            </div>
          )}
          {dispatchError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {dispatchError}
            </div>
          )}
        </div>

        {/* Polling-Protokoll (wf_monitor_poll) */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              Polling-Protokoll{" "}
              {stats && <span className="text-gray-400 font-normal">({stats.wf_poll_recent.length} Einträge)</span>}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                className="rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                {cleaning ? "Bereinigen…" : "Alte Datensätze löschen"}
              </button>
              <button
                onClick={handleDeleteAll}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Alle Daten löschen
              </button>
            </div>
          </div>
          {cleanResult && (
            <div className={`mx-5 my-3 rounded-lg border px-4 py-3 text-sm ${cleanResult.message ? "border-gray-200 bg-gray-50 text-gray-600" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              {cleanResult.message
                ? cleanResult.message
                : `Bereinigt: ${cleanResult.deleted_polls} Polling-Einträge, ${cleanResult.deleted_values} Messwerte gelöscht (Schwelle co_id < ${cleanResult.threshold})`}
            </div>
          )}
          {!stats || stats.wf_poll_recent.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Keine Polling-Einträge vorhanden</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-3 text-left font-medium">co_id</th>
                    <th className="px-4 py-3 text-left font-medium">Projekt</th>
                    <th className="px-4 py-3 text-left font-medium">Monitor</th>
                    <th className="px-4 py-3 text-left font-medium">Zeitstempel</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Hash-Value</th>
                    <th className="px-4 py-3 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.wf_poll_recent.map((r) => (
                    <tr key={r.co_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{r.co_id}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{r.project_name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.monitor_name}</td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtTs(r.polled_at, tz)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                          r.status === "send"     ? "bg-green-100 text-green-700" :
                          r.status === "konstant" ? "bg-amber-100 text-amber-700" :
                          r.status === "import"   ? "bg-blue-100 text-blue-700" :
                          r.status === "error"    ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500" title={r.hash_value ?? ""}>
                        {r.hash_value ? r.hash_value.slice(0, 8) + "…" : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleDelete(r.co_id)}
                          className="text-xs text-red-500 hover:text-red-700 hover:underline"
                          title={`Messwerte für co_id=${r.co_id} löschen`}
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ausstehende Datensätze */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Ausstehende Datensätze</h2>
            {stats && (
              <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${hasPending ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                {stats.pending}
              </span>
            )}
          </div>
          {!stats || stats.pending_records.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Keine ausstehenden Datensätze</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-3 text-left font-medium">co_id</th>
                    <th className="px-4 py-3 text-left font-medium">Zeitstempel</th>
                    <th className="px-4 py-3 text-left font-medium">Projekt</th>
                    <th className="px-4 py-3 text-left font-medium">Monitor</th>
                    <th className="px-4 py-3 text-left font-medium">Variable</th>
                    <th className="px-4 py-3 text-left font-medium">Bit-Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.pending_records.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.co_id ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtTs(r.ts, tz)}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{r.project_name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.monitor_name ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{r.variable_name ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-blue-700">{r.bit_value ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Zuletzt versendet */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Zuletzt verarbeitet <span className="text-gray-400 font-normal">(letzte 20)</span></h2>
          </div>
          {!stats || stats.recent_sent.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Noch keine Datensätze verarbeitet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-3 text-left font-medium">co_id</th>
                    <th className="px-4 py-3 text-left font-medium">Datum</th>
                    <th className="px-4 py-3 text-left font-medium">Projekt</th>
                    <th className="px-4 py-3 text-left font-medium">Monitor</th>
                    <th className="px-4 py-3 text-left font-medium">Variable</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.recent_sent.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.co_id ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtTs(r.status_timestamp, tz)}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{r.project_name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.monitor_name ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{r.variable_name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                          r.status === "send"     ? "bg-green-100 text-green-700" :
                          r.status === "konstant" ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
