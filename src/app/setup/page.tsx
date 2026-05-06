"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

interface SetupRecord {
  name: string;
  dispatch_delta_time: number;
  start_workflow: number;
  display_timezone: string;
  aktiv_record_counts: number;
  workflow_enabled: number;
  archive_hour: number;
  modify_status: string;
  version: number;
}

interface FormState {
  name: string;
  dispatch_delta_time: string;
  start_workflow: string;
  display_timezone: string;
  aktiv_record_counts: string;
  archive_hour: string;
}

const EMPTY: FormState = {
  name: "", dispatch_delta_time: "3600", start_workflow: "1000",
  display_timezone: "Europe/Vienna", aktiv_record_counts: "100", archive_hour: "48",
};

export default function SetupPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const [records, setRecords] = useState<SetupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SetupRecord | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/setup");
      if (res.ok) setRecords(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

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

  function openNew() {
    setSelected(null);
    setForm(EMPTY);
    setIsNew(true);
    setFormError(null);
  }

  function openEdit(r: SetupRecord) {
    setSelected(r);
    setForm({
      name: r.name,
      dispatch_delta_time: String(r.dispatch_delta_time),
      start_workflow: String(r.start_workflow ?? 1000),
      display_timezone: r.display_timezone ?? "Europe/Vienna",
      aktiv_record_counts: String(r.aktiv_record_counts ?? 100),
      archive_hour: String(r.archive_hour),
    });
    setIsNew(false);
    setFormError(null);
  }

  function cancelForm() {
    setSelected(null);
    setIsNew(false);
    setForm(EMPTY);
    setFormError(null);
  }

  async function handleToggleWorkflow(name: string) {
    setToggling(name);
    try {
      const res = await fetch(`/api/setup/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_workflow" }),
      });
      if (res.ok) await load();
    } finally {
      setToggling(null);
    }
  }

  async function handleSave() {
    const name = form.name.trim();
    const dispatch_delta_time = parseInt(form.dispatch_delta_time);
    const start_workflow = parseInt(form.start_workflow);
    const display_timezone = form.display_timezone.trim();
    const aktiv_record_counts = parseInt(form.aktiv_record_counts);
    const archive_hour = parseInt(form.archive_hour);

    if (!name) { setFormError("Name ist erforderlich"); return; }
    if (isNaN(dispatch_delta_time) || dispatch_delta_time < 1) { setFormError("Dispatch-Delta-Time muss ≥ 1 sein"); return; }
    if (isNaN(start_workflow) || start_workflow < 100) { setFormError("Workflow-Intervall muss ≥ 100 ms sein"); return; }
    if (!display_timezone) { setFormError("Zeitzone ist erforderlich"); return; }
    if (isNaN(aktiv_record_counts) || aktiv_record_counts < 1) { setFormError("Aktiv-Record-Count muss ≥ 1 sein"); return; }
    if (isNaN(archive_hour) || archive_hour < 1) { setFormError("Archiv-Stunden muss ≥ 1 sein"); return; }

    setSaving(true);
    setFormError(null);
    try {
      const url    = isNew ? "/api/setup" : `/api/setup/${encodeURIComponent(selected!.name)}`;
      const method = isNew ? "POST" : "PUT";
      const payload = isNew
        ? { name, dispatch_delta_time, start_workflow, display_timezone, aktiv_record_counts, archive_hour }
        : { dispatch_delta_time, start_workflow, display_timezone, aktiv_record_counts, archive_hour };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Fehler beim Speichern");
        return;
      }
      await load();
      cancelForm();
    } catch {
      setFormError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(name: string) {
    if (!window.confirm(`Setup-Eintrag '${name}' löschen?`)) return;
    const res = await fetch(`/api/setup/${encodeURIComponent(name)}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      if (selected?.name === name) cancelForm();
    }
  }

  const showForm = isNew || selected !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <button onClick={() => router.back()} className="mb-2 text-sm text-blue-600 hover:underline block">
              ← Zurück
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Setup</h1>
            <p className="text-sm text-gray-500 mt-1">Globale Applikations-Parameter</p>
          </div>
          <button
            onClick={openNew}
            className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Neu
          </button>
        </div>

        {/* Liste */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Einstellungen</h2>
          </div>
          {loading ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Laden…</p>
          ) : records.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Keine Einträge vorhanden</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Workflow</th>
                    <th className="px-4 py-3 text-right font-medium">Dispatch-Delta (Sek)</th>
                    <th className="px-4 py-3 text-right font-medium">Workflow (ms)</th>
                    <th className="px-4 py-3 text-left font-medium">Zeitzone</th>
                    <th className="px-4 py-3 text-right font-medium">Aktiv-Records</th>
                    <th className="px-4 py-3 text-right font-medium">Archiv-Std</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((r) => (
                    <tr
                      key={r.name}
                      className={`hover:bg-gray-50 cursor-pointer ${selected?.name === r.name ? "bg-blue-50" : ""}`}
                      onClick={() => openEdit(r)}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleWorkflow(r.name)}
                          disabled={toggling === r.name}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                            r.workflow_enabled
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          } disabled:opacity-50`}
                        >
                          {toggling === r.name ? "…" : r.workflow_enabled ? "aktiv" : "gestoppt"}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-700">{r.dispatch_delta_time}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-700">{r.start_workflow ?? 1000}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.display_timezone ?? "Europe/Vienna"}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-700">{r.aktiv_record_counts ?? 100}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-700">{r.archive_hour}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                          r.modify_status === "inserted" || r.modify_status === "updated"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}>{r.modify_status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(r.name)}
                          className="text-xs text-red-500 hover:text-red-700 hover:underline"
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

        {/* Formular */}
        {showForm && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-5">
              {isNew ? "Neuer Eintrag" : `Bearbeiten: ${selected!.name}`}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={!isNew}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder="z.B. Rasing"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Dispatch-Delta-Time (Sekunden) *
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.dispatch_delta_time}
                  onChange={(e) => setForm({ ...form, dispatch_delta_time: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="3600"
                />
                <p className="text-xs text-gray-400 mt-1">Mindestabstand zwischen E-Mail-Versand (Standard: 3600 Sek = 1 Std)</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Workflow-Intervall (ms) *
                </label>
                <input
                  type="number"
                  min={100}
                  value={form.start_workflow}
                  onChange={(e) => setForm({ ...form, start_workflow: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="1000"
                />
                <p className="text-xs text-gray-400 mt-1">Pause zwischen automatischen Workflow-Läufen (Standard: 1000 ms)</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Anzeige-Zeitzone *
                </label>
                <input
                  type="text"
                  value={form.display_timezone}
                  onChange={(e) => setForm({ ...form, display_timezone: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Europe/Vienna"
                />
                <p className="text-xs text-gray-400 mt-1">IANA-Zeitzone für Anzeige (z.B. Europe/Vienna, Europe/Berlin)</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Aktiv-Record-Count *
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.aktiv_record_counts}
                  onChange={(e) => setForm({ ...form, aktiv_record_counts: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="100"
                />
                <p className="text-xs text-gray-400 mt-1">Anzahl der letzten co_id-Datensätze, die beim Bereinigen behalten werden</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Archiv-Stunden *
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.archive_hour}
                  onChange={(e) => setForm({ ...form, archive_hour: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="48"
                />
                <p className="text-xs text-gray-400 mt-1">Bewegungsdaten älter als N Stunden werden archiviert</p>
              </div>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Speichern…" : "Speichern"}
              </button>
              <button
                onClick={cancelForm}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
