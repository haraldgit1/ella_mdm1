"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { DeviceVariable } from "@/types/variable";
import AuditInfo from "@/components/AuditInfo";

interface LookupEntry { code: string; description: string; }

const LAST_CLICKED_KEY = "variables_last_clicked";

const EMPTY_FORM = {
  project_name: "", device_name: "", name: "", title: "",
  datablock: "", data_type: "", offset: "", range: "", unit: "", detail_json: "",
};

export default function VariablesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState({
    project_name: searchParams.get("project_name") ?? "",
    device_name:  searchParams.get("device_name")  ?? "",
    name:         searchParams.get("name")         ?? "",
    title:        searchParams.get("title")        ?? "",
    data_type:    searchParams.get("data_type")    ?? "",
  });
  const [results, setResults] = useState<DeviceVariable[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const [dataTypeList, setDataTypeList] = useState<LookupEntry[]>([]);

  // Dialog state
  const [dialog, setDialog] = useState<"none" | "new" | "edit">("none");
  const [editKey, setEditKey] = useState<{ project_name: string; device_name: string; name: string } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function rowKey(r: DeviceVariable) { return `${r.project_name}/${r.device_name}/${r.name}`; }

  useEffect(() => {
    fetch("/api/lookups?function=300").then((r) => r.json()).then((d) => setDataTypeList(Array.isArray(d) ? d : []));
    if (searchParams.get("searched")) runSearch({
      project_name: searchParams.get("project_name") ?? "",
      device_name:  searchParams.get("device_name")  ?? "",
      name:         searchParams.get("name")         ?? "",
      title:        searchParams.get("title")        ?? "",
      data_type:    searchParams.get("data_type")    ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!searched) return;
    const last = sessionStorage.getItem(LAST_CLICKED_KEY);
    if (last && rowRefs.current[last]) {
      setHighlighted(last);
      rowRefs.current[last]?.scrollIntoView({ block: "center", behavior: "instant" });
      sessionStorage.removeItem(LAST_CLICKED_KEY);
    }
  }, [searched, results]);

  async function runSearch(s: typeof search) {
    setLoading(true);
    const p = new URLSearchParams();
    Object.entries(s).forEach(([k, v]) => { if (v) p.set(k, v); });
    const res = await fetch(`/api/variables?${p}`);
    const data = await res.json();
    setResults(Array.isArray(data) ? data : []);
    setSearched(true);
    setLoading(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    Object.entries(search).forEach(([k, v]) => { if (v) p.set(k, v); });
    p.set("searched", "1");
    router.replace(`/variables?${p}`);
    await runSearch(search);
  }

  function handleRowClick(row: DeviceVariable) {
    const key = rowKey(row);
    setHighlighted(key);
    sessionStorage.setItem(LAST_CLICKED_KEY, key);
    setEditKey({ project_name: row.project_name, device_name: row.device_name, name: row.name });
    setForm({
      project_name: row.project_name, device_name: row.device_name, name: row.name,
      title: row.title, datablock: row.datablock ?? "", data_type: row.data_type,
      offset: row.offset ?? "", range: row.range ?? "",
      unit: row.unit ?? "", detail_json: row.detail_json ?? "",
    });
    setFormError("");
    setConfirmDelete(false);
    setDialog("edit");
  }

  function handleNewClick() {
    setForm(EMPTY_FORM);
    setFormError("");
    setConfirmDelete(false);
    setEditKey(null);
    setDialog("new");
  }

  function closeDialog() { setDialog("none"); setEditKey(null); }

  async function handleSave() {
    setFormError("");
    if (!form.name?.trim())     { setFormError("Name fehlt"); return; }
    if (!form.title?.trim())    { setFormError("Bezeichnung fehlt"); return; }
    if (!form.data_type?.trim()){ setFormError("DataType fehlt"); return; }
    setSaving(true);

    if (dialog === "new") {
      if (!form.project_name?.trim()) { setFormError("ProjektName fehlt"); setSaving(false); return; }
      if (!form.device_name?.trim())  { setFormError("DeviceName fehlt"); setSaving(false); return; }
      const res = await fetch("/api/variables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, datablock: form.datablock || null, offset: form.offset || null, range: form.range || null, unit: form.unit || null, detail_json: form.detail_json || null }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok) { setFormError(data.error ?? "Fehler"); return; }
    } else if (dialog === "edit" && editKey) {
      const res = await fetch(
        `/api/variables/${encodeURIComponent(editKey.project_name)}/${encodeURIComponent(editKey.device_name)}/${encodeURIComponent(editKey.name)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: form.title, datablock: form.datablock || null, data_type: form.data_type, offset: form.offset || null, range: form.range || null, unit: form.unit || null, detail_json: form.detail_json || null }),
        }
      );
      const data = await res.json();
      setSaving(false);
      if (!res.ok) { setFormError(data.error ?? "Fehler"); return; }
    }
    closeDialog();
    await runSearch(search);
  }

  async function handleDelete() {
    if (!editKey) return;
    await fetch(
      `/api/variables/${encodeURIComponent(editKey.project_name)}/${encodeURIComponent(editKey.device_name)}/${encodeURIComponent(editKey.name)}`,
      { method: "DELETE" }
    );
    closeDialog();
    await runSearch(search);
  }

  const dtLabel = (code: string) => dataTypeList.find((t) => t.code === code)?.description ?? code;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
          <h1 className="text-lg font-semibold text-gray-900">Variablen</h1>
        </div>
        <button onClick={handleNewClick}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Neuanlage
        </button>
      </header>

      <main className="flex flex-col gap-6 p-6">
        {/* Suchmaske */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Suche</h2>
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            {[
              { label: "ProjektName", field: "project_name" as const, width: "w-36" },
              { label: "DeviceName",  field: "device_name"  as const, width: "w-36" },
              { label: "Name",        field: "name"         as const, width: "w-32" },
              { label: "Bezeichnung", field: "title"        as const, width: "w-40" },
            ].map(({ label, field, width }) => (
              <div key={field} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">{label}</label>
                <input type="text" value={search[field]}
                  onChange={(e) => setSearch((p) => ({ ...p, [field]: e.target.value }))}
                  className={`${width} rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500`} />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">DataType</label>
              <select value={search.data_type} onChange={(e) => setSearch((p) => ({ ...p, data_type: e.target.value }))}
                className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500">
                <option value="">Alle</option>
                {dataTypeList.map((t) => <option key={t.code} value={t.code}>{t.description}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={loading}
                className="rounded-lg bg-gray-900 px-5 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
                {loading ? "Suche…" : "Suche"}
              </button>
            </div>
          </form>
        </div>

        {/* Ergebnisliste */}
        {searched && (
          <div className="rounded-xl border border-gray-200 bg-white">
            {results.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">Keine Variablen gefunden.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">ProjektName</th>
                    <th className="px-4 py-3">DeviceName</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Bezeichnung</th>
                    <th className="px-4 py-3">Datenbaustein</th>
                    <th className="px-4 py-3">DataType</th>
                    <th className="px-4 py-3">Offset</th>
                    <th className="px-4 py-3">Einheit</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => {
                    const key = rowKey(row);
                    const hl = highlighted === key;
                    return (
                      <tr key={key} ref={(el) => { rowRefs.current[key] = el; }}
                        onClick={() => handleRowClick(row)}
                        className={`cursor-pointer border-b border-gray-100 last:border-0 ${hl ? "bg-blue-100" : "hover:bg-blue-50"}`}>
                        <td className={`px-4 py-3 ${hl ? "font-semibold text-gray-900" : "text-gray-500"}`}>{row.project_name}</td>
                        <td className={`px-4 py-3 ${hl ? "font-semibold text-gray-900" : "text-gray-500"}`}>{row.device_name}</td>
                        <td className={`px-4 py-3 text-blue-700 ${hl ? "font-bold" : "font-medium"}`}>{row.name}</td>
                        <td className={`px-4 py-3 ${hl ? "font-semibold text-gray-900" : "text-gray-700"}`}>{row.title}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{row.datablock ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{dtLabel(row.data_type)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{row.offset ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{row.unit ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* Dialog */}
      {dialog !== "none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                {dialog === "new" ? "Neue Variable" : `${editKey?.project_name} / ${editKey?.device_name} / ${editKey?.name}`}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 px-6 py-4">
              {dialog === "new" && (
                <>
                  <DField label="ProjektName *">
                    <input type="text" value={form.project_name} onChange={(e) => setForm((p) => ({ ...p, project_name: e.target.value }))}
                      className={fi(false)} />
                  </DField>
                  <DField label="DeviceName *">
                    <input type="text" value={form.device_name} onChange={(e) => setForm((p) => ({ ...p, device_name: e.target.value }))}
                      className={fi(false)} />
                  </DField>
                  <DField label="Name *">
                    <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className={fi(false)} />
                  </DField>
                </>
              )}
              {dialog === "edit" && (
                <>
                  <DField label="ProjektName">
                    <input type="text" value={form.project_name} disabled className={fi(true)} />
                  </DField>
                  <DField label="DeviceName">
                    <input type="text" value={form.device_name} disabled className={fi(true)} />
                  </DField>
                  <DField label="Name">
                    <input type="text" value={form.name} disabled className={fi(true)} />
                  </DField>
                </>
              )}
              <DField label="Bezeichnung *">
                <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className={fi(false)} />
              </DField>
              <DField label="Datenbaustein">
                <input type="text" value={form.datablock} onChange={(e) => setForm((p) => ({ ...p, datablock: e.target.value }))}
                  placeholder="DB10" className={fi(false)} />
              </DField>
              <DField label="DataType *">
                <select value={form.data_type} onChange={(e) => setForm((p) => ({ ...p, data_type: e.target.value }))}
                  className={fi(false)}>
                  <option value="">— bitte wählen —</option>
                  {dataTypeList.map((t) => <option key={t.code} value={t.code}>{t.description}</option>)}
                </select>
              </DField>
              <DField label="Offset">
                <input type="text" value={form.offset} onChange={(e) => setForm((p) => ({ ...p, offset: e.target.value }))}
                  placeholder="DB10.DBD0" className={fi(false)} />
              </DField>
              <DField label="Wertebereich">
                <input type="text" value={form.range} onChange={(e) => setForm((p) => ({ ...p, range: e.target.value }))}
                  placeholder="0..100" className={fi(false)} />
              </DField>
              <DField label="Einheit">
                <input type="text" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  placeholder="kW" className={fi(false)} />
              </DField>
              <DField label="Technische Details (JSON)" className="col-span-2">
                <textarea rows={3} value={form.detail_json}
                  onChange={(e) => setForm((p) => ({ ...p, detail_json: e.target.value }))}
                  className={fi(false) + " resize-none font-mono text-xs"} />
              </DField>
            </div>

            {dialog === "edit" && (
              <div className="px-6 pb-2">
                <AuditInfo
                  create_user={results.find((r) => r.project_name === editKey?.project_name && r.device_name === editKey?.device_name && r.name === editKey?.name)?.create_user}
                  create_timestamp={results.find((r) => r.project_name === editKey?.project_name && r.device_name === editKey?.device_name && r.name === editKey?.name)?.create_timestamp}
                  modify_user={results.find((r) => r.project_name === editKey?.project_name && r.device_name === editKey?.device_name && r.name === editKey?.name)?.modify_user}
                  modify_timestamp={results.find((r) => r.project_name === editKey?.project_name && r.device_name === editKey?.device_name && r.name === editKey?.name)?.modify_timestamp}
                  modify_status={results.find((r) => r.project_name === editKey?.project_name && r.device_name === editKey?.device_name && r.name === editKey?.name)?.modify_status}
                  version={results.find((r) => r.project_name === editKey?.project_name && r.device_name === editKey?.device_name && r.name === editKey?.name)?.version}
                />
              </div>
            )}

            {formError && <p className="px-6 pb-2 text-sm text-red-600">{formError}</p>}

            {confirmDelete && (
              <div className="mx-6 mb-3 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2">
                <p className="text-sm text-red-700">Wirklich löschen?</p>
                <button onClick={handleDelete} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700">Ja</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-600 hover:text-gray-900">Nein</button>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
              <button onClick={closeDialog} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Abbrechen
              </button>
              <div className="flex gap-2">
                {dialog === "edit" && (
                  <button onClick={() => setConfirmDelete(true)}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                    Löschen
                  </button>
                )}
                <button onClick={handleSave} disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Speichert…" : "Speichern"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function fi(disabled: boolean) {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none ${
    disabled
      ? "border-gray-200 bg-gray-50 text-gray-500"
      : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
  }`;
}
