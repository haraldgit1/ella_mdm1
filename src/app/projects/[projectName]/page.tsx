"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Project } from "@/types/project";

type Tab = "allgemein" | "adresse" | "technik";

const TABS: { key: Tab; label: string }[] = [
  { key: "allgemein", label: "Allgemein" },
  { key: "adresse",   label: "Adresse" },
  { key: "technik",   label: "Technik" },
];

const EMPTY: Partial<Project> = {
  project_name: "", title: "", short_description: "", project_type_code: "",
  street: "", house_no: "", postal_code: "", city: "", country: "",
  primary_ip_address: "", secondary_ip_address: "",
  alarm_interval_sec: undefined, alarm_count_limit: undefined,
};

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectName: string }>;
}) {
  const { projectName } = use(params);
  const isNew = projectName === "new";
  const router = useRouter();

  const [form, setForm] = useState<Partial<Project>>(EMPTY);
  const [tab, setTab] = useState<Tab>("allgemein");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isLocked = form.modify_status === "locked";

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/projects/${encodeURIComponent(projectName)}`)
      .then((r) => r.json())
      .then((data) => { setForm(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectName, isNew]);

  function set(field: keyof Project, value: string | number | undefined) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    const method = isNew ? "POST" : "PUT";
    const url = isNew ? "/api/projects" : `/api/projects/${encodeURIComponent(projectName)}`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Fehler"); return; }
    if (isNew) router.replace(`/projects/${encodeURIComponent(data.project_name)}`);
  }

  async function handleDelete() {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, { method: "DELETE" });
    if (res.ok) router.push("/projects");
  }

  async function handleLock() {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock" }),
    });
    if (res.ok) setForm((f) => ({ ...f, modify_status: "locked" }));
  }

  async function handleCopy() {
    const copy = { ...form, project_name: `${form.project_name}_KOPIE` };
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(copy),
    });
    const data = await res.json();
    if (res.ok) router.push(`/projects/${encodeURIComponent(data.project_name)}`);
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Laden…</p></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-700">← Projekte</Link>
          <h1 className="text-lg font-semibold text-gray-900">
            {isNew ? "Neues Projekt" : form.project_name}
          </h1>
          {isLocked && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
              Gesperrt
            </span>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-0 p-6">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab-Inhalt */}
        <div className="rounded-b-xl border border-t-0 border-gray-200 bg-white p-6">
          {tab === "allgemein" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="ProjektName *" required>
                <input
                  type="text"
                  value={form.project_name ?? ""}
                  onChange={(e) => set("project_name", e.target.value)}
                  disabled={!isNew || isLocked}
                  className={input(!isNew || isLocked)}
                />
              </Field>
              <Field label="Bezeichnung *" required>
                <input
                  type="text"
                  value={form.title ?? ""}
                  onChange={(e) => set("title", e.target.value)}
                  disabled={isLocked}
                  className={input(isLocked)}
                />
              </Field>
              <Field label="Kurzbeschreibung" className="sm:col-span-2">
                <textarea
                  rows={3}
                  value={form.short_description ?? ""}
                  onChange={(e) => set("short_description", e.target.value)}
                  disabled={isLocked}
                  className={input(isLocked) + " resize-none"}
                />
              </Field>
              <Field label="ProjektTyp">
                <input
                  type="text"
                  value={form.project_type_code ?? ""}
                  onChange={(e) => set("project_type_code", e.target.value)}
                  disabled={isLocked}
                  className={input(isLocked)}
                />
              </Field>
            </div>
          )}

          {tab === "adresse" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Straße">
                <input type="text" value={form.street ?? ""} onChange={(e) => set("street", e.target.value)} disabled={isLocked} className={input(isLocked)} />
              </Field>
              <Field label="Hausnummer">
                <input type="text" value={form.house_no ?? ""} onChange={(e) => set("house_no", e.target.value)} disabled={isLocked} className={input(isLocked)} />
              </Field>
              <Field label="PLZ">
                <input type="text" value={form.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} disabled={isLocked} className={input(isLocked)} />
              </Field>
              <Field label="Stadt">
                <input type="text" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} disabled={isLocked} className={input(isLocked)} />
              </Field>
              <Field label="Land">
                <input type="text" value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} disabled={isLocked} className={input(isLocked)} />
              </Field>
            </div>
          )}

          {tab === "technik" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Primäre IP-Adresse">
                <input type="text" value={form.primary_ip_address ?? ""} onChange={(e) => set("primary_ip_address", e.target.value)} disabled={isLocked} className={input(isLocked)} />
              </Field>
              <Field label="Sekundäre IP-Adresse">
                <input type="text" value={form.secondary_ip_address ?? ""} onChange={(e) => set("secondary_ip_address", e.target.value)} disabled={isLocked} className={input(isLocked)} />
              </Field>
              <Field label="Alarm-Intervall (Sek.)">
                <input
                  type="number" min={0}
                  value={form.alarm_interval_sec ?? ""}
                  onChange={(e) => set("alarm_interval_sec", e.target.value ? Number(e.target.value) : undefined)}
                  disabled={isLocked}
                  className={input(isLocked)}
                />
              </Field>
              <Field label="Alarm-Count-Limit">
                <input
                  type="number" min={0}
                  value={form.alarm_count_limit ?? ""}
                  onChange={(e) => set("alarm_count_limit", e.target.value ? Number(e.target.value) : undefined)}
                  disabled={isLocked}
                  className={input(isLocked)}
                />
              </Field>
            </div>
          )}
        </div>

        {/* Fehlermeldung */}
        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}

        {/* Lösch-Bestätigung */}
        {confirmDelete && (
          <div className="mt-4 flex items-center gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">Wollen Sie den Datensatz wirklich löschen?</p>
            <button onClick={handleDelete} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Ja</button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Nein</button>
          </div>
        )}

        {/* Aktionsbuttons */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/projects")}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Abbrechen
          </button>

          <div className="flex gap-2">
            {!isNew && !isLocked && (
              <button onClick={handleLock} className="rounded-lg border border-yellow-400 px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-50">
                Sperren
              </button>
            )}
            {!isNew && !isLocked && (
              <button onClick={() => setConfirmDelete(true)} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                Löschen
              </button>
            )}
            {!isNew && !isLocked && (
              <button onClick={handleCopy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Kopieren
              </button>
            )}
            {isNew && (
              <button
                onClick={() => { setForm(EMPTY); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Neuanlage
              </button>
            )}
            {!isLocked && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Speichert…" : "Speichern"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children, className = "", required }: {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium text-gray-600">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function input(disabled: boolean) {
  return `rounded-lg border px-3 py-2 text-sm outline-none ${
    disabled
      ? "border-gray-200 bg-gray-50 text-gray-500"
      : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
  }`;
}
