"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

interface PendingRecord {
  id: number;
  ts: string;
  bit_value: string | null;
  co_id: string | null;
  project_name: string | null;
  monitor_name: string | null;
  variable_name: string | null;
}

interface SentRecord {
  id: number;
  ts: string;
  status_timestamp: string;
  bit_value: string | null;
  project_name: string | null;
  monitor_name: string | null;
  variable_name: string | null;
}

interface Stats {
  pending: number;
  sent_24h: number;
  pending_records: PendingRecord[];
  recent_sent: SentRecord[];
}

interface DispatchResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
  delta_minutes: number;
}

function fmtTs(ts: string): string {
  return ts.replace("T", " ").slice(0, 19);
}

export default function EmailDispatchPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [deltaMinutes, setDeltaMinutes] = useState(60);
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
        body: JSON.stringify({ delta_minutes: deltaMinutes }),
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

  const hasPending = (stats?.pending ?? 0) > 0;

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
            <p className="text-3xl font-bold text-blue-600">{deltaMinutes}</p>
            <p className="text-xs text-gray-400 mt-1">Minuten Mindestabstand</p>
          </div>
        </div>

        {/* Dispatch-Aktion */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Dispatch ausführen</h2>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Delta-Time (Min)
              <input
                type="number"
                min={0}
                max={1440}
                value={deltaMinutes}
                onChange={(e) => setDeltaMinutes(Number(e.target.value))}
                className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm"
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
              {" "}(gesamt {lastResult.processed} Datensätze, Delta-Time {lastResult.delta_minutes} Min)
            </div>
          )}
          {dispatchError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {dispatchError}
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
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtTs(r.ts)}</td>
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
            <h2 className="text-sm font-semibold text-gray-700">Zuletzt versendet <span className="text-gray-400 font-normal">(letzte 20)</span></h2>
          </div>
          {!stats || stats.recent_sent.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Noch keine E-Mails versendet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-3 text-left font-medium">Gesendet am</th>
                    <th className="px-4 py-3 text-left font-medium">Projekt</th>
                    <th className="px-4 py-3 text-left font-medium">Monitor</th>
                    <th className="px-4 py-3 text-left font-medium">Variable</th>
                    <th className="px-4 py-3 text-left font-medium">Bit-Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.recent_sent.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtTs(r.status_timestamp)}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{r.project_name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.monitor_name ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{r.variable_name ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-green-700">{r.bit_value ?? "—"}</td>
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
