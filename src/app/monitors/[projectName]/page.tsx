"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, use, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Monitor, MonitorVariable } from "@/types/monitor";
import AuditInfo from "@/components/AuditInfo";

type Tab = "allgemein" | "beschreibung" | "technik" | "variablen";

const TABS: { key: Tab; label: string }[] = [
  { key: "allgemein",    label: "Allgemein" },
  { key: "beschreibung", label: "Beschreibung" },
  { key: "technik",      label: "Technische Daten" },
  { key: "variablen",    label: "Variablen" },
];

const EMPTY: Partial<Monitor> = {
  project_name: "", monitor_name: "", title: "", status: "active",
  type: "", datablock: "", request_url: "", response_file: "", short_description: "", detail_json: "",
};

export default function MonitorDetailPage({
  params,
}: {
  params: Promise<{ projectName: string }>;
}) {
  const { projectName } = use(params);
  const searchParams = useSearchParams();
  const monitorName = searchParams.get("monitor") ?? "new";
  const isNew = projectName === "new" && monitorName === "new";
  const isCopy = searchParams.get("copy") === "1";
  const router = useRouter();

  const [form, setForm] = useState<Partial<Monitor>>(EMPTY);
  const [tab, setTab] = useState<Tab>("allgemein");
  const [loading, setLoading] = useState(!isNew || isCopy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [projectList, setProjectList] = useState<{ project_name: string; title: string }[]>([]);
  const [monitorTypeList, setMonitorTypeList] = useState<{ code: string; description: string }[]>([]);
  const [dataTypeList, setDataTypeList] = useState<{ code: string; description: string }[]>([]);

  const [variables, setVariables] = useState<MonitorVariable[]>([]);
  const [newVar, setNewVar] = useState({ name: "", title: "", datablock: "", data_type: "", offset: "" });
  const [varError, setVarError] = useState("");
  const [editVar, setEditVar] = useState<{ name: string; title: string; datablock: string; data_type: string; offset: string } | null>(null);
  const [editVarError, setEditVarError] = useState("");
  const [spsLoading, setSpsLoading] = useState(false);
  const [spsStatus, setSpsStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [tsImportLoading, setTsImportLoading] = useState(false);
  const [tsImportStatus, setTsImportStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pollLoading, setPollLoading] = useState(false);
  const [pollStatus, setPollStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfStatus, setWfStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLocked = form.modify_status === "locked";

  const loadVariables = useCallback(async (pn: string, mn: string) => {
    const res = await fetch(`/api/monitor-variables?project_name=${encodeURIComponent(pn)}&monitor_name=${encodeURIComponent(mn)}`);
    if (res.ok) setVariables(await res.json());
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/lookups?function=400").then((r) => r.json()),
      fetch("/api/lookups?function=300").then((r) => r.json()),
    ]).then(([projects, monitorTypes, dataTypes]) => {
      setProjectList(Array.isArray(projects) ? projects : []);
      setMonitorTypeList(Array.isArray(monitorTypes) ? monitorTypes : []);
      setDataTypeList(Array.isArray(dataTypes) ? dataTypes : []);
    });

    if (isNew && !isCopy) { setLoading(false); return; }
    fetch(`/api/monitors/${encodeURIComponent(projectName)}/${encodeURIComponent(monitorName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (isCopy) {
          setForm({ ...data, monitor_name: `${data.monitor_name}_KOPIE`, modify_status: undefined });
        } else {
          setForm(data);
          if (data.datablock) setNewVar((p) => ({ ...p, datablock: data.datablock }));
          loadVariables(projectName, monitorName);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectName, monitorName, isNew, isCopy, loadVariables]);

  function set(field: keyof Monitor, value: string | undefined) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setError("");
    const actAsNew = isNew || isCopy;
    setSaving(true);
    const method = actAsNew ? "POST" : "PUT";
    const url = actAsNew
      ? "/api/monitors"
      : `/api/monitors/${encodeURIComponent(projectName)}/${encodeURIComponent(monitorName)}`;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Fehler"); return; }
    if (actAsNew || data.monitor_name !== monitorName) {
      router.replace(`/monitors/${encodeURIComponent(data.project_name)}?monitor=${encodeURIComponent(data.monitor_name)}`);
    }
  }

  async function handleDelete() {
    const res = await fetch(
      `/api/monitors/${encodeURIComponent(projectName)}/${encodeURIComponent(monitorName)}`,
      { method: "DELETE" }
    );
    if (res.ok) router.push("/monitors");
  }

  async function handleLock() {
    const res = await fetch(
      `/api/monitors/${encodeURIComponent(projectName)}/${encodeURIComponent(monitorName)}`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lock" }) }
    );
    if (res.ok) setForm((f) => ({ ...f, modify_status: "locked" }));
  }

  async function handleUnlock() {
    const res = await fetch(
      `/api/monitors/${encodeURIComponent(projectName)}/${encodeURIComponent(monitorName)}`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unlock" }) }
    );
    if (res.ok) setForm((f) => ({ ...f, modify_status: "updated" }));
  }

  function handleCopy() {
    router.push(`/monitors/${encodeURIComponent(projectName)}?monitor=${encodeURIComponent(monitorName)}&copy=1`);
  }

  async function handleCreateMonitorInterface() {
    setSpsLoading(true);
    setSpsStatus(null);
    const res = await fetch("/api/monitor-interface", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_name: projectName, monitor_name: monitorName }),
    });
    const data = await res.json();
    setSpsLoading(false);
    if (!res.ok) {
      setSpsStatus({ ok: false, msg: data.error ?? "Fehler" });
    } else {
      setSpsStatus({ ok: true, msg: `${data.filename} erstellt (${data.count} Variablen)` });
    }
  }

  async function handleWorkflow() {
    setWfLoading(true);
    setWfStatus(null);

    const pollRes = await fetch("/api/monitor-poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_name: projectName, monitor_name: monitorName }),
    });
    const pollData = await pollRes.json();
    if (!pollRes.ok) {
      setWfLoading(false);
      setWfStatus({ ok: false, msg: `Abfrage: ${pollData.error ?? "Fehler"}` });
      return;
    }

    const dispatchRes = await fetch("/api/email-dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const dispatchData = await dispatchRes.json();
    setWfLoading(false);
    if (!dispatchRes.ok) {
      setWfStatus({ ok: false, msg: `Dispatch: ${dispatchData.error ?? "Fehler"}` });
    } else {
      setWfStatus({
        ok: true,
        msg: `${pollData.imported} Werte importiert · ${dispatchData.sent} E-Mails · ${dispatchData.konstant} konstant`,
      });
    }
  }

  async function handlePoll() {
    setPollLoading(true);
    setPollStatus(null);
    const res = await fetch("/api/monitor-poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_name: projectName, monitor_name: monitorName }),
    });
    const data = await res.json();
    setPollLoading(false);
    if (!res.ok) {
      setPollStatus({ ok: false, msg: data.error ?? "Fehler" });
    } else {
      setPollStatus({ ok: true, msg: `${data.imported} Werte importiert, co_id=${data.co_id}` });
    }
  }

  async function handleTsImport(file: File) {
    setTsImportLoading(true);
    setTsImportStatus(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("project_name", projectName);
    fd.append("monitor_name", monitorName);
    const res = await fetch("/api/ts-import", { method: "POST", body: fd });
    const data = await res.json();
    setTsImportLoading(false);
    if (!res.ok) {
      setTsImportStatus({ ok: false, msg: data.error ?? "Fehler" });
    } else {
      setTsImportStatus({ ok: true, msg: `${data.imported} Werte importiert, ${data.skipped} übersprungen` });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAddVariable(e: React.FormEvent) {
    e.preventDefault();
    setVarError("");
    const res = await fetch("/api/monitor-variables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: projectName,
        monitor_name: monitorName,
        name:      newVar.name,
        title:     newVar.title,
        datablock: newVar.datablock || null,
        data_type: newVar.data_type,
        offset:    newVar.offset || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setVarError(data.error ?? "Fehler"); return; }
    setNewVar({ name: "", title: "", datablock: "", data_type: "", offset: "" });
    loadVariables(projectName, monitorName);
  }

  async function handleDeleteVariable(name: string) {
    await fetch(
      `/api/monitor-variables/${encodeURIComponent(projectName)}/${encodeURIComponent(monitorName)}/${encodeURIComponent(name)}`,
      { method: "DELETE" }
    );
    loadVariables(projectName, monitorName);
  }

  function startEditVar(v: MonitorVariable) {
    setEditVar({ name: v.name, title: v.title, datablock: v.datablock ?? "", data_type: v.data_type, offset: v.offset ?? "" });
    setEditVarError("");
  }

  async function handleUpdateVariable(e: React.FormEvent) {
    e.preventDefault();
    if (!editVar) return;
    setEditVarError("");
    const res = await fetch(
      `/api/monitor-variables/${encodeURIComponent(projectName)}/${encodeURIComponent(monitorName)}/${encodeURIComponent(editVar.name)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:     editVar.title,
          datablock: editVar.datablock || null,
          data_type: editVar.data_type,
          offset:    editVar.offset || null,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) { setEditVarError(data.error ?? "Fehler"); return; }
    setEditVar(null);
    loadVariables(projectName, monitorName);
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Laden…</p></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Monitors</button>
          <h1 className="text-lg font-semibold text-gray-900">
            {isNew ? "Neuer Monitor" : isCopy ? `Kopie von ${form.project_name} / ${monitorName}` : `${form.project_name} / ${form.monitor_name}`}
          </h1>
          {isLocked && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Gesperrt</span>
          )}
        </div>
        {!isNew && !isCopy && (
          <div className="flex items-center gap-3">
            {spsStatus && (
              <span className={`text-xs font-medium ${spsStatus.ok ? "text-green-600" : "text-red-600"}`}>
                {spsStatus.ok ? "✓ " : "✗ "}{spsStatus.msg}
              </span>
            )}
            {tsImportStatus && (
              <span className={`text-xs font-medium ${tsImportStatus.ok ? "text-green-600" : "text-red-600"}`}>
                {tsImportStatus.ok ? "✓ " : "✗ "}{tsImportStatus.msg}
              </span>
            )}
            {pollStatus && (
              <span className={`text-xs font-medium ${pollStatus.ok ? "text-green-600" : "text-red-600"}`}>
                {pollStatus.ok ? "✓ " : "✗ "}{pollStatus.msg}
              </span>
            )}
            {wfStatus && (
              <span className={`text-xs font-medium ${wfStatus.ok ? "text-green-600" : "text-red-600"}`}>
                {wfStatus.ok ? "✓ " : "✗ "}{wfStatus.msg}
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTsImport(f); }}
            />
            <button onClick={() => fileInputRef.current?.click()} disabled={tsImportLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {tsImportLoading ? "Importiert…" : "Messwerte importieren"}
            </button>
            <button onClick={handlePoll} disabled={pollLoading || wfLoading}
              className="rounded-lg border border-blue-300 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50">
              {pollLoading ? "Abfrage läuft…" : "Messwerte abfragen"}
            </button>
            <button onClick={handleWorkflow} disabled={wfLoading || pollLoading}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {wfLoading ? "WorkFlow läuft…" : "Start WorkFlow"}
            </button>
            <button onClick={handleCreateMonitorInterface} disabled={spsLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {spsLoading ? "Erstellt…" : "SPS-Interface-Datei erstellen"}
            </button>
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-0 p-6">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white px-6">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-b-xl border border-t-0 border-gray-200 bg-white p-6">
          {tab === "allgemein" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="ProjektName *">
                {(isNew || isCopy) ? (
                  <select value={form.project_name ?? ""} onChange={(e) => set("project_name", e.target.value)}
                    disabled={isLocked} className={inp(isLocked)}>
                    <option value="">— bitte wählen —</option>
                    {projectList.map((p) => (
                      <option key={p.project_name} value={p.project_name}>{p.project_name} — {p.title}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={form.project_name ?? ""} disabled className={inp(true)} />
                )}
              </Field>
              <Field label="MonitorName *">
                <input type="text" value={form.monitor_name ?? ""} onChange={(e) => set("monitor_name", e.target.value)}
                  disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="Bezeichnung *">
                <input type="text" value={form.title ?? ""} onChange={(e) => set("title", e.target.value)}
                  disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="Status">
                <select value={form.status ?? "active"} onChange={(e) => set("status", e.target.value)}
                  disabled={isLocked} className={inp(isLocked)}>
                  <option value="active">Aktiv</option>
                  <option value="inactive">Inaktiv</option>
                </select>
              </Field>
              <Field label="Typ">
                <select value={form.type ?? ""} onChange={(e) => set("type", e.target.value)}
                  disabled={isLocked} className={inp(isLocked)}>
                  <option value="">— bitte wählen —</option>
                  {monitorTypeList.map((t) => (
                    <option key={t.code} value={t.code}>{t.description}</option>
                  ))}
                </select>
              </Field>
              <Field label="Datenbaustein (Default für Variablen)">
                <input type="text" value={form.datablock ?? ""} onChange={(e) => set("datablock", e.target.value)}
                  disabled={isLocked} placeholder="DB10" className={inp(isLocked)} />
              </Field>
              <Field label="SPS Request URL" className="sm:col-span-2">
                <input type="text" value={form.request_url ?? ""} onChange={(e) => set("request_url", e.target.value)}
                  disabled={isLocked} placeholder="http://192.168.0.10/awp/api/PLC_KH_Visu.html"
                  className={inp(isLocked)} />
              </Field>
              <Field label="Response-Dateiname">
                <input type="text" value={form.response_file ?? ""} onChange={(e) => set("response_file", e.target.value)}
                  disabled={isLocked} placeholder="PLC_KH_Visu.html" className={inp(isLocked)} />
              </Field>
            </div>
          )}

          {tab === "beschreibung" && (
            <Field label="Beschreibung" className="w-full">
              <textarea rows={8} value={form.short_description ?? ""}
                onChange={(e) => set("short_description", e.target.value)}
                disabled={isLocked} placeholder="Beschreibungstext…"
                className={inp(isLocked) + " resize-none"} />
            </Field>
          )}

          {tab === "technik" && (
            <Field label="Technische Details (JSON)" className="w-full">
              <textarea rows={8} value={form.detail_json ?? ""}
                onChange={(e) => set("detail_json", e.target.value)}
                disabled={isLocked} placeholder={'{\n  "protocol": "Modbus",\n  "address": "192.168.1.10"\n}'}
                className={inp(isLocked) + " resize-none font-mono text-xs"} />
            </Field>
          )}

          {tab === "variablen" && !isNew && !isCopy && (
            <div className="flex flex-col gap-4">
              {variables.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Variablen vorhanden.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-3">Name</th>
                      <th className="pb-2 pr-3">Bezeichnung</th>
                      <th className="pb-2 pr-3">Datenbaustein</th>
                      <th className="pb-2 pr-3">DataType</th>
                      <th className="pb-2 pr-3">Offset</th>
                      {!isLocked && <th className="pb-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map((v) =>
                      editVar?.name === v.name ? (
                        <tr key={v.name} className="border-b border-blue-100 bg-blue-50">
                          <td className="py-2 pr-3 font-medium text-blue-700">{v.name}</td>
                          <td className="py-2 pr-3">
                            <input type="text" value={editVar.title}
                              onChange={(e) => setEditVar((p) => p && ({ ...p, title: e.target.value }))}
                              className="w-full rounded border border-blue-300 px-2 py-1 text-sm outline-none focus:border-blue-500" />
                          </td>
                          <td className="py-2 pr-3">
                            <input type="text" value={editVar.datablock}
                              onChange={(e) => setEditVar((p) => p && ({ ...p, datablock: e.target.value }))}
                              placeholder="DB10"
                              className="w-20 rounded border border-blue-300 px-2 py-1 text-sm font-mono outline-none focus:border-blue-500" />
                          </td>
                          <td className="py-2 pr-3">
                            <select value={editVar.data_type}
                              onChange={(e) => setEditVar((p) => p && ({ ...p, data_type: e.target.value }))}
                              className="rounded border border-blue-300 px-2 py-1 text-sm outline-none focus:border-blue-500">
                              <option value="">—</option>
                              {dataTypeList.map((t) => (
                                <option key={t.code} value={t.code}>{t.description}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <input type="text" value={editVar.offset}
                              onChange={(e) => setEditVar((p) => p && ({ ...p, offset: e.target.value }))}
                              placeholder="DB10.DBD0"
                              className="w-24 rounded border border-blue-300 px-2 py-1 text-sm font-mono outline-none focus:border-blue-500" />
                          </td>
                          <td className="py-2">
                            <div className="flex gap-2">
                              <button onClick={handleUpdateVariable}
                                className="text-xs font-medium text-blue-600 hover:text-blue-800">Speichern</button>
                              <button onClick={() => setEditVar(null)}
                                className="text-xs text-gray-400 hover:text-gray-600">Abbrechen</button>
                            </div>
                            {editVarError && <p className="text-xs text-red-600 mt-1">{editVarError}</p>}
                          </td>
                        </tr>
                      ) : (
                        <tr key={v.name} className="border-b border-gray-100 last:border-0">
                          <td className="py-2 pr-3 font-medium text-blue-700">{v.name}</td>
                          <td className="py-2 pr-3">{v.title}</td>
                          <td className="py-2 pr-3 font-mono text-xs text-gray-400">{v.datablock ?? "—"}</td>
                          <td className="py-2 pr-3 text-gray-500">
                            {dataTypeList.find((t) => t.code === v.data_type)?.description ?? v.data_type}
                          </td>
                          <td className="py-2 pr-3 font-mono text-gray-500 text-xs">{v.offset ?? "—"}</td>
                          {!isLocked && (
                            <td className="py-2">
                              <div className="flex gap-3">
                                <button onClick={() => startEditVar(v)}
                                  className="text-xs text-blue-500 hover:text-blue-700">Ändern</button>
                                <button onClick={() => handleDeleteVariable(v.name)}
                                  className="text-xs text-red-500 hover:text-red-700">Löschen</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              )}
              {!isLocked && (
                <form onSubmit={handleAddVariable} className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
                  <Field label="Name *">
                    <input type="text" value={newVar.name}
                      onChange={(e) => setNewVar((p) => ({ ...p, name: e.target.value }))}
                      className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
                  </Field>
                  <Field label="Bezeichnung">
                    <input type="text" value={newVar.title}
                      onChange={(e) => setNewVar((p) => ({ ...p, title: e.target.value }))}
                      className="w-44 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
                  </Field>
                  <Field label="Datenbaustein">
                    <input type="text" value={newVar.datablock}
                      onChange={(e) => setNewVar((p) => ({ ...p, datablock: e.target.value }))}
                      placeholder="DB10"
                      className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
                  </Field>
                  <Field label="DataType *">
                    <select value={newVar.data_type}
                      onChange={(e) => setNewVar((p) => ({ ...p, data_type: e.target.value }))}
                      className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500">
                      <option value="">—</option>
                      {dataTypeList.map((t) => (
                        <option key={t.code} value={t.code}>{t.description}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Offset">
                    <input type="text" value={newVar.offset}
                      onChange={(e) => setNewVar((p) => ({ ...p, offset: e.target.value }))}
                      placeholder="DB10.DBD0"
                      className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
                  </Field>
                  <button type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                    Hinzufügen
                  </button>
                  {varError && <p className="w-full text-xs text-red-600">{varError}</p>}
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

        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}

        {confirmDelete && (
          <div className="mt-4 flex items-center gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">Wollen Sie den Monitor wirklich löschen?</p>
            <button onClick={handleDelete} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Ja</button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Nein</button>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => router.back()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Abbrechen
          </button>
          <div className="flex gap-2">
            {!isNew && (
              isLocked
                ? <button onClick={handleUnlock} className="rounded-lg border border-green-500 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50">Freigabe</button>
                : <button onClick={handleLock} className="rounded-lg border border-yellow-400 px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-50">Sperren</button>
            )}
            {!isNew && (
              <button onClick={() => setConfirmDelete(true)} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Löschen</button>
            )}
            {!isNew && (
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
