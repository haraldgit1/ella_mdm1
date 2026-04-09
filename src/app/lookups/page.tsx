"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuditInfo from "@/components/AuditInfo";

interface LookupRow {
  function_code: number;
  code: string;
  description: string;
  function_text: string | null;
  create_user: string;
  create_timestamp: string;
  modify_user: string;
  modify_timestamp: string;
  modify_status: string;
  version: number;
}

const LAST_CLICKED_KEY = "lookups_last_clicked";

const EMPTY_FORM = {
  function_code: "",
  function_text: "",
  code: "",
  description: "",
};

export default function LookupsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState({
    function_code: searchParams.get("function_code") ?? "",
    function_text: searchParams.get("function_text") ?? "",
    code:          searchParams.get("code")          ?? "",
    description:   searchParams.get("description")   ?? "",
  });
  const [results, setResults] = useState<LookupRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const [dialog, setDialog] = useState<"none" | "new" | "edit">("none");
  const [editKey, setEditKey] = useState<{ function_code: number; code: string } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function rowKey(r: LookupRow) { return `${r.function_code}/${r.code}`; }

  useEffect(() => {
    if (searchParams.get("searched")) runSearch({
      function_code: searchParams.get("function_code") ?? "",
      function_text: searchParams.get("function_text") ?? "",
      code:          searchParams.get("code")          ?? "",
      description:   searchParams.get("description")   ?? "",
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
    if (s.function_code) p.set("function_code", s.function_code);
    if (s.function_text) p.set("function_text", s.function_text);
    if (s.code)          p.set("code", s.code);
    if (s.description)   p.set("description", s.description);
    const res = await fetch(`/api/lookups?${p}`);
    const data = await res.json();
    setResults(Array.isArray(data) ? data : []);
    setSearched(true);
    setLoading(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (search.function_code) p.set("function_code", search.function_code);
    if (search.function_text) p.set("function_text", search.function_text);
    if (search.code)          p.set("code", search.code);
    if (search.description)   p.set("description", search.description);
    p.set("searched", "1");
    router.replace(`/lookups?${p}`);
    await runSearch(search);
  }

  function handleRowClick(row: LookupRow) {
    const key = rowKey(row);
    setHighlighted(key);
    sessionStorage.setItem(LAST_CLICKED_KEY, key);
    setEditKey({ function_code: row.function_code, code: row.code });
    setForm({
      function_code: String(row.function_code),
      function_text: row.function_text ?? "",
      code: row.code,
      description: row.description,
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
    if (!form.function_code) { setFormError("Function-Code fehlt"); return; }
    if (!form.code?.trim())  { setFormError("Code fehlt"); return; }
    if (!form.description?.trim()) { setFormError("Beschreibung fehlt"); return; }
    setSaving(true);

    if (dialog === "new") {
      const res = await fetch("/api/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function_code: Number(form.function_code),
          code: form.code.trim(),
          description: form.description.trim(),
          function_text: form.function_text?.trim() || null,
        }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok) { setFormError(data.error ?? "Fehler"); return; }
    } else if (dialog === "edit" && editKey) {
      const res = await fetch(
        `/api/lookups/${editKey.function_code}/${encodeURIComponent(editKey.code)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: form.description.trim(),
            function_text: form.function_text?.trim() || null,
          }),
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
    await fetch(`/api/lookups/${editKey.function_code}/${encodeURIComponent(editKey.code)}`, {
      method: "DELETE",
    });
    closeDialog();
    await runSearch(search);
  }

  const currentRow = editKey
    ? results.find((r) => r.function_code === editKey.function_code && r.code === editKey.code)
    : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
          <h1 className="text-lg font-semibold text-gray-900">Lookup-Werte</h1>
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
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Function-Code</label>
              <input type="number" value={search.function_code}
                onChange={(e) => setSearch((p) => ({ ...p, function_code: e.target.value }))}
                className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Funktion-Text</label>
              <input type="text" value={search.function_text}
                onChange={(e) => setSearch((p) => ({ ...p, function_text: e.target.value }))}
                className="w-36 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Code</label>
              <input type="text" value={search.code}
                onChange={(e) => setSearch((p) => ({ ...p, code: e.target.value }))}
                className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Beschreibung</label>
              <input type="text" value={search.description}
                onChange={(e) => setSearch((p) => ({ ...p, description: e.target.value }))}
                className="w-44 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
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
              <p className="p-6 text-sm text-gray-500">Keine Lookup-Werte gefunden.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Function-Code</th>
                    <th className="px-4 py-3">Funktion-Text</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Beschreibung</th>
                    <th className="px-4 py-3">Version</th>
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
                        <td className={`px-4 py-3 font-mono ${hl ? "font-bold text-gray-900" : "text-gray-500"}`}>{row.function_code}</td>
                        <td className={`px-4 py-3 ${hl ? "font-semibold text-gray-900" : "text-gray-500"}`}>{row.function_text ?? "—"}</td>
                        <td className={`px-4 py-3 text-blue-700 ${hl ? "font-bold" : "font-medium"}`}>{row.code}</td>
                        <td className={`px-4 py-3 ${hl ? "font-semibold text-gray-900" : "text-gray-700"}`}>{row.description}</td>
                        <td className="px-4 py-3 text-gray-400">{row.version}</td>
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
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                {dialog === "new" ? "Neuer Lookup-Wert" : `${editKey?.function_code} / ${editKey?.code}`}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4 px-6 py-4">
              <DField label="Function-Code *">
                <input type="number" value={form.function_code}
                  disabled={dialog === "edit"}
                  onChange={(e) => setForm((p) => ({ ...p, function_code: e.target.value }))}
                  className={fi(dialog === "edit")} />
              </DField>
              <DField label="Funktion-Text">
                <input type="text" value={form.function_text}
                  onChange={(e) => setForm((p) => ({ ...p, function_text: e.target.value }))}
                  placeholder="z.B. DeviceType"
                  className={fi(false)} />
              </DField>
              <DField label="Code *">
                <input type="text" value={form.code}
                  disabled={dialog === "edit"}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  className={fi(dialog === "edit")} />
              </DField>
              <DField label="Beschreibung *">
                <input type="text" value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className={fi(false)} />
              </DField>
            </div>

            {dialog === "edit" && currentRow && (
              <div className="px-6 pb-2">
                <AuditInfo
                  create_user={currentRow.create_user}
                  create_timestamp={currentRow.create_timestamp}
                  modify_user={currentRow.modify_user}
                  modify_timestamp={currentRow.modify_timestamp}
                  modify_status={currentRow.modify_status}
                  version={currentRow.version}
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
              <button onClick={closeDialog}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
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
