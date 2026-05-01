"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { MessageText } from "@/types/message_text";

type LookupRow = { code: string; description: string };

const EMPTY_FORM = {
  message_text: "",
  message_class: "",
  trigger_tag: "",
  trigger_bit: "",
  trigger_address: "",
  hmi_acknowledgment_tag: "",
  hmi_acknowledgment_bit: "",
  hmi_acknowledgment_address: "",
  report: false,
};
type FormState = typeof EMPTY_FORM;

export default function MessageTextsPage() {
  const [search, setSearch] = useState({ project_name: "", message_name: "", message_text: "", message_class: "" });
  const [results, setResults] = useState<MessageText[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alarmClasses, setAlarmClasses] = useState<LookupRow[]>([]);

  const [selected, setSelected] = useState<MessageText | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [newProjectName, setNewProjectName] = useState("");
  const [newMessageName, setNewMessageName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/lookups?function=500")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAlarmClasses(data); });
  }, []);

  async function buildParams() {
    const p = new URLSearchParams();
    if (search.project_name)  p.set("project_name",  search.project_name);
    if (search.message_name)  p.set("message_name",  search.message_name);
    if (search.message_text)  p.set("message_text",  search.message_text);
    if (search.message_class) p.set("message_class", search.message_class);
    return p;
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/message-texts?${await buildParams()}`);
    const data = await res.json();
    setResults(Array.isArray(data) ? data : []);
    setSearched(true);
    setLoading(false);
  }

  async function reloadList() {
    const res = await fetch(`/api/message-texts?${await buildParams()}`);
    const data = await res.json();
    if (Array.isArray(data)) setResults(data);
  }

  function rowToForm(row: MessageText): FormState {
    return {
      message_text:               row.message_text,
      message_class:              row.message_class ?? "",
      trigger_tag:                row.trigger_tag ?? "",
      trigger_bit:                row.trigger_bit?.toString() ?? "",
      trigger_address:            row.trigger_address ?? "",
      hmi_acknowledgment_tag:     row.hmi_acknowledgment_tag ?? "",
      hmi_acknowledgment_bit:     row.hmi_acknowledgment_bit?.toString() ?? "",
      hmi_acknowledgment_address: row.hmi_acknowledgment_address ?? "",
      report:                     row.report === 1,
    };
  }

  function openDetail(row: MessageText) {
    setSelected(row);
    setIsNew(false);
    setForm(rowToForm(row));
    setError("");
  }

  function openNew() {
    setSelected(null);
    setIsNew(true);
    setForm(EMPTY_FORM);
    setNewProjectName("");
    setNewMessageName("");
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

    const payload = {
      message_text:               form.message_text.trim(),
      message_class:              form.message_class || null,
      trigger_tag:                form.trigger_tag.trim() || null,
      trigger_bit:                form.trigger_bit !== "" ? Number(form.trigger_bit) : null,
      trigger_address:            form.trigger_address.trim() || null,
      hmi_acknowledgment_tag:     form.hmi_acknowledgment_tag.trim() || null,
      hmi_acknowledgment_bit:     form.hmi_acknowledgment_bit !== "" ? Number(form.hmi_acknowledgment_bit) : null,
      hmi_acknowledgment_address: form.hmi_acknowledgment_address.trim() || null,
      report:                     form.report,
    };

    if (isNew) {
      const res = await fetch("/api/message-texts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_name: newProjectName.trim(), message_name: newMessageName.trim(), ...payload }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fehler"); setSaving(false); return; }
    } else if (selected) {
      const res = await fetch(
        `/api/message-texts/${encodeURIComponent(selected.project_name)}/${encodeURIComponent(selected.message_name)}`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fehler"); setSaving(false); return; }
    }

    setSaving(false);
    closeDialog();
    if (searched) await reloadList();
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Meldungstext "${selected.message_name}" löschen?`)) return;
    setSaving(true);
    const res = await fetch(
      `/api/message-texts/${encodeURIComponent(selected.project_name)}/${encodeURIComponent(selected.message_name)}`,
      { method: "DELETE" }
    );
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Fehler"); return; }
    closeDialog();
    setResults((prev) =>
      prev.filter((r) => !(r.project_name === selected.project_name && r.message_name === selected.message_name))
    );
  }

  const showDialog = isNew || selected !== null;
  const inp = "rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
          <h1 className="text-lg font-semibold text-gray-900">Meldungstexte</h1>
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
                className={`w-44 ${inp}`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">MessageName</label>
              <input
                type="text"
                value={search.message_name}
                onChange={(e) => setSearch({ ...search, message_name: e.target.value })}
                className={`w-48 ${inp}`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Meldungstext</label>
              <input
                type="text"
                value={search.message_text}
                onChange={(e) => setSearch({ ...search, message_text: e.target.value })}
                className={`w-64 ${inp}`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Klasse</label>
              <select
                value={search.message_class}
                onChange={(e) => setSearch({ ...search, message_class: e.target.value })}
                className={`w-44 ${inp}`}
              >
                <option value="">— alle —</option>
                {alarmClasses.map((ac) => (
                  <option key={ac.code} value={ac.description}>{ac.description}</option>
                ))}
              </select>
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
              <p className="p-6 text-sm text-gray-500">Keine Meldungstexte gefunden.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">ProjektName</th>
                    <th className="px-4 py-3 text-center w-12">ID</th>
                    <th className="px-4 py-3">MessageName</th>
                    <th className="px-4 py-3">Meldungstext</th>
                    <th className="px-4 py-3">Klasse</th>
                    <th className="px-4 py-3 text-center w-12">Bit</th>
                    <th className="px-4 py-3 text-center w-16">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr
                      key={`${row.project_name}__${row.message_name}`}
                      onClick={() => openDetail(row)}
                      className="cursor-pointer border-b border-gray-100 hover:bg-blue-50 last:border-0"
                    >
                      <td className="px-4 py-3 text-gray-700">{row.project_name}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{row.id}</td>
                      <td className="px-4 py-3 font-medium text-blue-700">{row.message_name}</td>
                      <td className="px-4 py-3 text-gray-700">{row.message_text}</td>
                      <td className="px-4 py-3">
                        {row.message_class && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            {row.message_class}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">{row.trigger_bit ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        {row.report === 1
                          ? <span className="text-xs font-medium text-green-600">Ja</span>
                          : <span className="text-xs text-gray-400">Nein</span>}
                      </td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <h2 className="mb-5 text-base font-semibold text-gray-900">
              {isNew ? "Meldungstext anlegen" : "Meldungstext bearbeiten"}
            </h2>

            <form onSubmit={handleSave} className="flex flex-col gap-5">

              {/* Identifikation */}
              {isNew ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">ProjektName *</label>
                    <input
                      required
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="z.B. WINDPARK-NORD"
                      className={inp}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">MessageName *</label>
                    <input
                      required
                      value={newMessageName}
                      onChange={(e) => setNewMessageName(e.target.value)}
                      placeholder="z.B. WEA_Bitmeldung_09"
                      className={inp}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-6 rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
                  <span><span className="font-medium">Projekt:</span> {selected?.project_name}</span>
                  <span><span className="font-medium">ID:</span> {selected?.id}</span>
                  <span><span className="font-medium">Name:</span> {selected?.message_name}</span>
                </div>
              )}

              {/* Meldung */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100 pb-1">Meldung</h3>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Meldungstext *</label>
                  <input
                    required
                    value={form.message_text}
                    onChange={(e) => setForm({ ...form, message_text: e.target.value })}
                    className={inp}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Klasse</label>
                    <select
                      value={form.message_class}
                      onChange={(e) => setForm({ ...form, message_class: e.target.value })}
                      className={inp}
                    >
                      <option value="">— keine —</option>
                      {alarmClasses.map((ac) => (
                        <option key={ac.code} value={ac.description}>{ac.description}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <input
                      id="chk-report"
                      type="checkbox"
                      checked={form.report}
                      onChange={(e) => setForm({ ...form, report: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <label htmlFor="chk-report" className="text-sm text-gray-700">Report</label>
                  </div>
                </div>
              </div>

              {/* Trigger */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100 pb-1">Trigger (SPS)</h3>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Trigger-Tag</label>
                  <input
                    value={form.trigger_tag}
                    onChange={(e) => setForm({ ...form, trigger_tag: e.target.value })}
                    placeholder="z.B. HMI Bereichszeiger.WEA_HMI_16_01"
                    className={inp}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Trigger-Bit (0–15)</label>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={form.trigger_bit}
                      onChange={(e) => setForm({ ...form, trigger_bit: e.target.value })}
                      className={inp}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Trigger-Adresse</label>
                    <input
                      value={form.trigger_address}
                      onChange={(e) => setForm({ ...form, trigger_address: e.target.value })}
                      placeholder="%DB31.DBX100.0"
                      className={inp}
                    />
                  </div>
                </div>
              </div>

              {/* HMI-Quittierung */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100 pb-1">HMI-Quittierung</h3>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Quittierungs-Tag</label>
                  <input
                    value={form.hmi_acknowledgment_tag}
                    onChange={(e) => setForm({ ...form, hmi_acknowledgment_tag: e.target.value })}
                    placeholder="z.B. HMI Fehler Quitt WEA_HMI_16_01"
                    className={inp}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Quittierungs-Bit (0–15)</label>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={form.hmi_acknowledgment_bit}
                      onChange={(e) => setForm({ ...form, hmi_acknowledgment_bit: e.target.value })}
                      className={inp}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Quittierungs-Adresse</label>
                    <input
                      value={form.hmi_acknowledgment_address}
                      onChange={(e) => setForm({ ...form, hmi_acknowledgment_address: e.target.value })}
                      placeholder="%DB31.DBX403.0"
                      className={inp}
                    />
                  </div>
                </div>
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
