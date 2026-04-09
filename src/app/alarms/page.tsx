"use client";

import { useState } from "react";
import Link from "next/link";

interface AlarmRow {
  project_name: string;
  alarm_level_code: string;
  alarm_text: string;
  severity_rank: number | null;
  modify_status: string;
}

const EMPTY_FORM = { alarm_text: "", severity_rank: "" };

export default function AlarmsPage() {
  const [search, setSearch] = useState({ project_name: "", alarm_level_code: "", alarm_text: "" });
  const [results, setResults] = useState<AlarmRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Detail-Dialog
  const [selected, setSelected] = useState<AlarmRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newProjectName, setNewProjectName] = useState("");
  const [newAlarmLevelCode, setNewAlarmLevelCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const params = new URLSearchParams();
    if (search.project_name)    params.set("project_name", search.project_name);
    if (search.alarm_level_code) params.set("alarm_level_code", search.alarm_level_code);
    if (search.alarm_text)      params.set("alarm_text", search.alarm_text);

    const res = await fetch(`/api/alarms?${params}`);
    const data = await res.json();
    setResults(Array.isArray(data) ? data : []);
    setSearched(true);
    setLoading(false);
  }

  function openDetail(row: AlarmRow) {
    setSelected(row);
    setIsNew(false);
    setForm({ alarm_text: row.alarm_text, severity_rank: row.severity_rank?.toString() ?? "" });
    setError("");
  }

  function openNew() {
    setSelected(null);
    setIsNew(true);
    setForm(EMPTY_FORM);
    setNewProjectName("");
    setNewAlarmLevelCode("");
    setError("");
  }

  function closeDialog() {
    setSelected(null);
    setIsNew(false);
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (isNew) {
      const res = await fetch("/api/alarms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: newProjectName.trim(),
          alarm_level_code: newAlarmLevelCode.trim(),
          alarm_text: form.alarm_text.trim(),
          severity_rank: form.severity_rank ? Number(form.severity_rank) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fehler"); setSaving(false); return; }
    } else if (selected) {
      const res = await fetch(
        `/api/alarms/${encodeURIComponent(selected.project_name)}/${encodeURIComponent(selected.alarm_level_code)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alarm_text: form.alarm_text.trim(),
            severity_rank: form.severity_rank ? Number(form.severity_rank) : null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fehler"); setSaving(false); return; }
    }

    setSaving(false);
    closeDialog();
    // Liste neu laden
    const params = new URLSearchParams();
    if (search.project_name)     params.set("project_name", search.project_name);
    if (search.alarm_level_code) params.set("alarm_level_code", search.alarm_level_code);
    if (search.alarm_text)       params.set("alarm_text", search.alarm_text);
    const res2 = await fetch(`/api/alarms?${params}`);
    const data2 = await res2.json();
    setResults(Array.isArray(data2) ? data2 : []);
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Alarm "${selected.alarm_level_code}" löschen?`)) return;
    setSaving(true);
    const res = await fetch(
      `/api/alarms/${encodeURIComponent(selected.project_name)}/${encodeURIComponent(selected.alarm_level_code)}`,
      { method: "DELETE" }
    );
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Fehler"); return; }
    closeDialog();
    setResults((prev) =>
      prev.filter(
        (r) => !(r.project_name === selected.project_name && r.alarm_level_code === selected.alarm_level_code)
      )
    );
  }

  const showDialog = isNew || selected !== null;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Alarme</h1>
        </div>
        <button
          onClick={openNew}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Neuanlage
        </button>
      </header>

      <main className="flex flex-col gap-6 p-6">
        {/* Suchmaske */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Suche</h2>
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">ProjektName</label>
              <input
                type="text"
                value={search.project_name}
                onChange={(e) => setSearch({ ...search, project_name: e.target.value })}
                className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Alarm-Stufe</label>
              <input
                type="text"
                value={search.alarm_level_code}
                onChange={(e) => setSearch({ ...search, alarm_level_code: e.target.value })}
                className="w-36 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Alarm-Text</label>
              <input
                type="text"
                value={search.alarm_text}
                onChange={(e) => setSearch({ ...search, alarm_text: e.target.value })}
                className="w-64 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-gray-900 px-5 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {loading ? "Suche…" : "Suche"}
              </button>
            </div>
          </form>
        </div>

        {/* Ergebnisliste */}
        {searched && (
          <div className="rounded-xl border border-gray-200 bg-white">
            {results.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">Keine Alarme gefunden.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">ProjektName</th>
                    <th className="px-4 py-3">Alarm-Stufe</th>
                    <th className="px-4 py-3">Alarm-Text</th>
                    <th className="px-4 py-3">Rang</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr
                      key={`${row.project_name}__${row.alarm_level_code}`}
                      onClick={() => openDetail(row)}
                      className="cursor-pointer border-b border-gray-100 hover:bg-blue-50 last:border-0"
                    >
                      <td className="px-4 py-3 text-gray-700">{row.project_name}</td>
                      <td className="px-4 py-3 font-medium text-blue-700">{row.alarm_level_code}</td>
                      <td className="px-4 py-3 text-gray-700">{row.alarm_text}</td>
                      <td className="px-4 py-3 text-gray-500">{row.severity_rank ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* Detail-Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <h2 className="mb-5 text-base font-semibold text-gray-900">
              {isNew ? "Alarm anlegen" : "Alarm bearbeiten"}
            </h2>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              {isNew ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">ProjektName *</label>
                    <input
                      required
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Alarm-Stufe *</label>
                    <input
                      required
                      value={newAlarmLevelCode}
                      onChange={(e) => setNewAlarmLevelCode(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span><span className="font-medium">Projekt:</span> {selected?.project_name}</span>
                    <span><span className="font-medium">Stufe:</span> {selected?.alarm_level_code}</span>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Alarm-Text *</label>
                <input
                  required
                  value={form.alarm_text}
                  onChange={(e) => setForm({ ...form, alarm_text: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Schweregrad (Rang)</label>
                <input
                  type="number"
                  min={0}
                  value={form.severity_rank}
                  onChange={(e) => setForm({ ...form, severity_rank: e.target.value })}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex justify-between pt-2">
                {!isNew && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="rounded-lg border border-red-300 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Löschen
                  </button>
                )}
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Speichern…" : "Speichern"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
