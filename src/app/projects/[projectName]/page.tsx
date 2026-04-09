"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Project } from "@/types/project";
import type { ProjectAlarm } from "@/types/alarm";
import type { ProjectEmail } from "@/types/email";
import AuditInfo from "@/components/AuditInfo";

type Tab = "allgemein" | "adresse" | "technik" | "alarmstufen" | "emails";

const TABS: { key: Tab; label: string }[] = [
  { key: "allgemein",   label: "Allgemein" },
  { key: "adresse",     label: "Adresse" },
  { key: "technik",     label: "Technik" },
  { key: "alarmstufen", label: "Alarmstufen" },
  { key: "emails",      label: "Ziel-E-Mails" },
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
  const searchParams = useSearchParams();
  const isCopy = searchParams.get("copy") === "1";
  const router = useRouter();

  const [form, setForm] = useState<Partial<Project>>(EMPTY);
  const [tab, setTab] = useState<Tab>("allgemein");
  const [loading, setLoading] = useState(!isNew || isCopy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [projectTypeList, setProjectTypeList] = useState<{ code: string; description: string }[]>([]);

  // Alarmstufen state
  const [alarms, setAlarms] = useState<ProjectAlarm[]>([]);
  const [newAlarm, setNewAlarm] = useState({ alarm_level_code: "", alarm_text: "", severity_rank: "" });
  const [alarmError, setAlarmError] = useState("");

  // E-Mail state
  const [emails, setEmails] = useState<ProjectEmail[]>([]);
  const [newEmail, setNewEmail] = useState({ email_address: "", email_purpose: "" });
  const [emailError, setEmailError] = useState("");

  const isLocked = form.modify_status === "locked";

  const loadAlarms = useCallback(async (name: string) => {
    const res = await fetch(`/api/alarms?project_name=${encodeURIComponent(name)}`);
    if (res.ok) setAlarms(await res.json());
  }, []);

  const loadEmails = useCallback(async (name: string) => {
    const res = await fetch(`/api/emails?projectName=${encodeURIComponent(name)}`);
    if (res.ok) setEmails(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/lookups?function=200")
      .then((r) => r.json())
      .then((data) => setProjectTypeList(Array.isArray(data) ? data : []));
    if (isNew && !isCopy) return;
    fetch(`/api/projects/${encodeURIComponent(projectName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (isCopy) {
          // Kopie-Modus: Daten übernehmen, ProjektName editierbar mit _KOPIE-Vorschlag
          setForm({ ...data, project_name: `${data.project_name}_KOPIE`, modify_status: undefined });
        } else {
          setForm(data);
          loadAlarms(projectName);
          loadEmails(projectName);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectName, isNew, isCopy, loadAlarms, loadEmails]);

  function set(field: keyof Project, value: string | number | undefined) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setError("");
    const actAsNew = isNew || isCopy;
    if (actAsNew && form.project_name && !/^[A-Za-z0-9_-]+$/.test(form.project_name)) {
      setError("ProjektName darf nur Buchstaben (A-Z), Ziffern, Bindestrich und Unterstrich enthalten (keine Umlaute oder Sonderzeichen)");
      return;
    }
    setSaving(true);
    const method = actAsNew ? "POST" : "PUT";
    const url = actAsNew ? "/api/projects" : `/api/projects/${encodeURIComponent(projectName)}`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Fehler"); return; }
    if (actAsNew) router.replace(`/projects/${encodeURIComponent(data.project_name)}`);
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

  async function handleUnlock() {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock" }),
    });
    if (res.ok) setForm((f) => ({ ...f, modify_status: "updated" }));
  }

  function handleCopy() {
    router.push(`/projects/${encodeURIComponent(projectName)}?copy=1`);
  }

  async function handleAddAlarm(e: React.FormEvent) {
    e.preventDefault();
    setAlarmError("");
    const res = await fetch("/api/alarms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: projectName,
        alarm_level_code: newAlarm.alarm_level_code,
        alarm_text: newAlarm.alarm_text,
        severity_rank: newAlarm.severity_rank ? Number(newAlarm.severity_rank) : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setAlarmError(data.error ?? "Fehler"); return; }
    setNewAlarm({ alarm_level_code: "", alarm_text: "", severity_rank: "" });
    loadAlarms(projectName);
  }

  async function handleDeleteAlarm(alarmLevelCode: string) {
    await fetch(`/api/alarms/${encodeURIComponent(projectName)}/${encodeURIComponent(alarmLevelCode)}`, {
      method: "DELETE",
    });
    loadAlarms(projectName);
  }

  async function handleAddEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    const res = await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: projectName,
        email_address: newEmail.email_address,
        email_purpose: newEmail.email_purpose || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setEmailError(data.error ?? "Fehler"); return; }
    setNewEmail({ email_address: "", email_purpose: "" });
    loadEmails(projectName);
  }

  async function handleDeleteEmail(emailAddress: string) {
    await fetch(`/api/emails/${encodeURIComponent(projectName)}/${encodeURIComponent(emailAddress)}`, {
      method: "DELETE",
    });
    loadEmails(projectName);
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Laden…</p></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Projekte</button>
          <h1 className="text-lg font-semibold text-gray-900">
            {isNew ? "Neues Projekt" : isCopy ? `Kopie von ${projectName}` : form.project_name}
          </h1>
          {isLocked && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Gesperrt</span>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-0 p-6">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white px-6">
          {TABS.filter((t) => !(isNew || isCopy) || t.key === "allgemein" || t.key === "adresse" || t.key === "technik").map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-b-xl border border-t-0 border-gray-200 bg-white p-6">
          {/* Allgemein */}
          {tab === "allgemein" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="ProjektName *">
                <input type="text" value={form.project_name ?? ""} onChange={(e) => set("project_name", e.target.value)}
                  disabled={(!isNew && !isCopy) || isLocked} className={inp((!isNew && !isCopy) || isLocked)} />
              </Field>
              <Field label="Bezeichnung *">
                <input type="text" value={form.title ?? ""} onChange={(e) => set("title", e.target.value)}
                  disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="Kurzbeschreibung" className="sm:col-span-2">
                <textarea rows={3} value={form.short_description ?? ""} onChange={(e) => set("short_description", e.target.value)}
                  disabled={isLocked} className={inp(isLocked) + " resize-none"} />
              </Field>
              <Field label="ProjektTyp">
                {(isNew || isCopy) ? (
                  <select value={form.project_type_code ?? ""} onChange={(e) => set("project_type_code", e.target.value)}
                    disabled={isLocked} className={inp(isLocked)}>
                    <option value="">— bitte wählen —</option>
                    {projectTypeList.map((t) => (
                      <option key={t.code} value={t.code}>{t.description}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text"
                    value={projectTypeList.find((t) => t.code === form.project_type_code)?.description ?? form.project_type_code ?? ""}
                    disabled className={inp(true)} />
                )}
              </Field>
            </div>
          )}

          {/* Adresse */}
          {tab === "adresse" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Straße">
                <input type="text" value={form.street ?? ""} onChange={(e) => set("street", e.target.value)} disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="Hausnummer">
                <input type="text" value={form.house_no ?? ""} onChange={(e) => set("house_no", e.target.value)} disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="PLZ">
                <input type="text" value={form.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="Stadt">
                <input type="text" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="Land">
                <input type="text" value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} disabled={isLocked} className={inp(isLocked)} />
              </Field>
            </div>
          )}

          {/* Technik */}
          {tab === "technik" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Primäre IP-Adresse">
                <input type="text" value={form.primary_ip_address ?? ""} onChange={(e) => set("primary_ip_address", e.target.value)} disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="Sekundäre IP-Adresse">
                <input type="text" value={form.secondary_ip_address ?? ""} onChange={(e) => set("secondary_ip_address", e.target.value)} disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="Alarm-Intervall (Sek.)">
                <input type="number" min={0} value={form.alarm_interval_sec ?? ""}
                  onChange={(e) => set("alarm_interval_sec", e.target.value ? Number(e.target.value) : undefined)}
                  disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="Alarm-Count-Limit">
                <input type="number" min={0} value={form.alarm_count_limit ?? ""}
                  onChange={(e) => set("alarm_count_limit", e.target.value ? Number(e.target.value) : undefined)}
                  disabled={isLocked} className={inp(isLocked)} />
              </Field>
            </div>
          )}

          {/* Alarmstufen */}
          {tab === "alarmstufen" && (
            <div className="flex flex-col gap-4">
              {/* Liste */}
              {alarms.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Alarmstufen vorhanden.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-4">Alarm-Stufe</th>
                      <th className="pb-2 pr-4">Alarm-Text</th>
                      <th className="pb-2 pr-4">Priorität</th>
                      {!isLocked && <th className="pb-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {alarms.map((a) => (
                      <tr key={a.alarm_level_code} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-4 font-medium">{a.alarm_level_code}</td>
                        <td className="py-2 pr-4 text-gray-700">{a.alarm_text}</td>
                        <td className="py-2 pr-4 text-gray-500">{a.severity_rank ?? "—"}</td>
                        {!isLocked && (
                          <td className="py-2">
                            <button onClick={() => handleDeleteAlarm(a.alarm_level_code)}
                              className="text-xs text-red-500 hover:text-red-700">Löschen</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Hinzufügen */}
              {!isLocked && (
                <form onSubmit={handleAddAlarm} className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
                  <Field label="Alarm-Stufe *">
                    <input type="text" value={newAlarm.alarm_level_code}
                      onChange={(e) => setNewAlarm((p) => ({ ...p, alarm_level_code: e.target.value }))}
                      className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
                  </Field>
                  <Field label="Alarm-Text *">
                    <input type="text" value={newAlarm.alarm_text}
                      onChange={(e) => setNewAlarm((p) => ({ ...p, alarm_text: e.target.value }))}
                      className="w-64 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
                  </Field>
                  <Field label="Priorität">
                    <input type="number" min={1} value={newAlarm.severity_rank}
                      onChange={(e) => setNewAlarm((p) => ({ ...p, severity_rank: e.target.value }))}
                      className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
                  </Field>
                  <button type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                    Hinzufügen
                  </button>
                  {alarmError && <p className="w-full text-xs text-red-600">{alarmError}</p>}
                </form>
              )}
            </div>
          )}

          {/* Ziel-E-Mails */}
          {tab === "emails" && (
            <div className="flex flex-col gap-4">
              {/* Liste */}
              {emails.length === 0 ? (
                <p className="text-sm text-gray-400">Keine E-Mail-Adressen vorhanden.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-4">E-Mail-Adresse</th>
                      <th className="pb-2 pr-4">Zweck</th>
                      <th className="pb-2 pr-4">Aktiv</th>
                      {!isLocked && <th className="pb-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {emails.map((e) => (
                      <tr key={e.email_address} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-4 font-medium">{e.email_address}</td>
                        <td className="py-2 pr-4 text-gray-500">{e.email_purpose ?? "—"}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            e.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            {e.is_active ? "Ja" : "Nein"}
                          </span>
                        </td>
                        {!isLocked && (
                          <td className="py-2">
                            <button onClick={() => handleDeleteEmail(e.email_address)}
                              className="text-xs text-red-500 hover:text-red-700">Löschen</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Hinzufügen */}
              {!isLocked && (
                <form onSubmit={handleAddEmail} className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
                  <Field label="E-Mail-Adresse *">
                    <input type="email" value={newEmail.email_address}
                      onChange={(e) => setNewEmail((p) => ({ ...p, email_address: e.target.value }))}
                      className="w-64 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
                  </Field>
                  <Field label="Zweck">
                    <input type="text" value={newEmail.email_purpose}
                      onChange={(e) => setNewEmail((p) => ({ ...p, email_purpose: e.target.value }))}
                      className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                      placeholder="z.B. Alarm" />
                  </Field>
                  <button type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                    Hinzufügen
                  </button>
                  {emailError && <p className="w-full text-xs text-red-600">{emailError}</p>}
                </form>
              )}
            </div>
          )}
        </div>

        {!isNew && !isCopy && (
          <AuditInfo
            create_user={form.create_user} create_timestamp={form.create_timestamp}
            modify_user={form.modify_user} modify_timestamp={form.modify_timestamp}
            modify_status={form.modify_status} version={form.version}
          />
        )}

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

        {/* Aktionsbuttons — nur für Hauptformular (nicht für Sub-Tabs) */}
        {(tab === "allgemein" || tab === "adresse" || tab === "technik") && (
          <div className="mt-4 flex items-center justify-between">
            <button onClick={() => router.back()}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Abbrechen
            </button>
            <div className="flex gap-2">
              {!isNew && !isCopy && (
                isLocked
                  ? <button onClick={handleUnlock} className="rounded-lg border border-green-500 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50">Freigabe</button>
                  : <button onClick={handleLock} className="rounded-lg border border-yellow-400 px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-50">Sperren</button>
              )}
              {!isNew && !isCopy && (
                <button onClick={() => setConfirmDelete(true)} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Löschen</button>
              )}
              {!isNew && !isCopy && (
                <button onClick={handleCopy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Kopieren</button>
              )}
              {(isNew || isCopy) && (
                <button onClick={() => setForm(EMPTY)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Neuanlage</button>
              )}
              <button onClick={handleSave} disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Speichert…" : "Speichern"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function inp(disabled: boolean) {
  return `rounded-lg border px-3 py-2 text-sm outline-none ${
    disabled
      ? "border-gray-200 bg-gray-50 text-gray-500"
      : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
  }`;
}
