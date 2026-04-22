"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Device } from "@/types/device";
import type { DeviceVariable } from "@/types/variable";
import AuditInfo from "@/components/AuditInfo";

type Tab = "allgemein" | "beschreibung" | "limits" | "alarm" | "technik" | "variablen";

const TABS: { key: Tab; label: string }[] = [
  { key: "allgemein",    label: "Allgemein" },
  { key: "beschreibung", label: "Beschreibung" },
  { key: "limits",       label: "Limits" },
  { key: "alarm",        label: "Alarm" },
  { key: "technik",      label: "Technische Daten" },
  { key: "variablen",    label: "Variablen" },
];

const EMPTY: Partial<Device> = {
  project_name: "", device_name: "", title: "", device_type_code: "",
  status: "active", alarm_enabled: 0,
  short_description_json: "", detail_json: "",
};

export default function DeviceDetailPage({
  params,
}: {
  params: Promise<{ projectName: string }>;
}) {
  const { projectName } = use(params);
  const searchParams = useSearchParams();
  const deviceName = searchParams.get("device") ?? "new";
  const isNew = projectName === "new" && deviceName === "new";
  const isCopy = searchParams.get("copy") === "1";
  const router = useRouter();

  const [form, setForm] = useState<Partial<Device>>(EMPTY);
  const [tab, setTab] = useState<Tab>("allgemein");
  const [loading, setLoading] = useState(!isNew || isCopy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [projectList, setProjectList] = useState<{ project_name: string; title: string }[]>([]);
  const [deviceTypeList, setDeviceTypeList] = useState<{ code: string; description: string }[]>([]);
  const [dataTypeList, setDataTypeList] = useState<{ code: string; description: string }[]>([]);

  const [variables, setVariables] = useState<DeviceVariable[]>([]);
  const [newVar, setNewVar] = useState({ name: "", title: "", datablock: "", data_type: "", offset: "", range: "", unit: "" });
  const [varError, setVarError] = useState("");

  const [spsLoading, setSpsLoading] = useState(false);
  const [spsStatus, setSpsStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const isLocked = form.modify_status === "locked";

  const loadVariables = useCallback(async (pn: string, dn: string) => {
    const res = await fetch(`/api/variables?project_name=${encodeURIComponent(pn)}&device_name=${encodeURIComponent(dn)}`);
    if (res.ok) setVariables(await res.json());
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/lookups?function=100").then((r) => r.json()),
      fetch("/api/lookups?function=300").then((r) => r.json()),
    ]).then(([projects, types, dataTypes]) => {
      setProjectList(Array.isArray(projects) ? projects : []);
      setDeviceTypeList(Array.isArray(types) ? types : []);
      setDataTypeList(Array.isArray(dataTypes) ? dataTypes : []);
    });
    if (isNew && !isCopy) { setLoading(false); return; }
    fetch(`/api/devices/${encodeURIComponent(projectName)}/${encodeURIComponent(deviceName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (isCopy) {
          setForm({ ...data, device_name: `${data.device_name}_KOPIE`, modify_status: undefined });
        } else {
          setForm(data);
          loadVariables(projectName, deviceName);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectName, deviceName, isNew, isCopy, loadVariables]);

  function set(field: keyof Device, value: string | number | undefined) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setError("");
    const actAsNew = isNew || isCopy;
    setSaving(true);
    const method = actAsNew ? "POST" : "PUT";
    const url = actAsNew
      ? "/api/devices"
      : `/api/devices/${encodeURIComponent(projectName)}/${encodeURIComponent(deviceName)}`;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Fehler"); return; }
    if (actAsNew) router.replace(`/devices/${encodeURIComponent(data.project_name)}?device=${encodeURIComponent(data.device_name)}`);
  }

  async function handleDelete() {
    const res = await fetch(
      `/api/devices/${encodeURIComponent(projectName)}/${encodeURIComponent(deviceName)}`,
      { method: "DELETE" }
    );
    if (res.ok) router.push("/devices");
  }

  async function handleLock() {
    const res = await fetch(
      `/api/devices/${encodeURIComponent(projectName)}/${encodeURIComponent(deviceName)}`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lock" }) }
    );
    if (res.ok) setForm((f) => ({ ...f, modify_status: "locked" }));
  }

  async function handleUnlock() {
    const res = await fetch(
      `/api/devices/${encodeURIComponent(projectName)}/${encodeURIComponent(deviceName)}`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unlock" }) }
    );
    if (res.ok) setForm((f) => ({ ...f, modify_status: "updated" }));
  }

  function handleCopy() {
    router.push(`/devices/${encodeURIComponent(projectName)}?device=${encodeURIComponent(deviceName)}&copy=1`);
  }

  async function handleAddVariable(e: React.FormEvent) {
    e.preventDefault();
    setVarError("");
    const res = await fetch("/api/variables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: projectName,
        device_name: deviceName,
        name: newVar.name,
        title: newVar.title,
        datablock: newVar.datablock || null,
        data_type: newVar.data_type,
        offset: newVar.offset || null,
        range: newVar.range || null,
        unit: newVar.unit || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setVarError(data.error ?? "Fehler"); return; }
    setNewVar({ name: "", title: "", datablock: "", data_type: "", offset: "", range: "", unit: "" });
    loadVariables(projectName, deviceName);
  }

  async function handleCreateSpsInterface() {
    setSpsLoading(true);
    setSpsStatus(null);
    const res = await fetch("/api/sps-interface", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_name: projectName, device_name: deviceName }),
    });
    const data = await res.json();
    setSpsLoading(false);
    if (!res.ok) {
      setSpsStatus({ ok: false, msg: data.error ?? "Fehler" });
    } else {
      setSpsStatus({ ok: true, msg: `${data.filename} erstellt (${data.count} Variablen)` });
    }
  }

  async function handleDeleteVariable(name: string) {
    await fetch(
      `/api/variables/${encodeURIComponent(projectName)}/${encodeURIComponent(deviceName)}/${encodeURIComponent(name)}`,
      { method: "DELETE" }
    );
    loadVariables(projectName, deviceName);
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Laden…</p></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Devices</button>
          <h1 className="text-lg font-semibold text-gray-900">
            {isNew ? "Neues Device" : isCopy ? `Kopie von ${form.project_name} / ${deviceName}` : `${form.project_name} / ${form.device_name}`}
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
            <button onClick={handleCreateSpsInterface} disabled={spsLoading}
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
              <Field label="DeviceName *">
                <input type="text" value={form.device_name ?? ""} onChange={(e) => set("device_name", e.target.value)}
                  disabled={!(isNew || isCopy) || isLocked} className={inp(!(isNew || isCopy) || isLocked)} />
              </Field>
              <Field label="Bezeichnung *">
                <input type="text" value={form.title ?? ""} onChange={(e) => set("title", e.target.value)}
                  disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="Typ *">
                <select value={form.device_type_code ?? ""} onChange={(e) => set("device_type_code", e.target.value)}
                  disabled={isLocked} className={inp(isLocked)}>
                  <option value="">— bitte wählen —</option>
                  {deviceTypeList.map((t) => (
                    <option key={t.code} value={t.code}>{t.description}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status ?? "active"} onChange={(e) => set("status", e.target.value)}
                  disabled={isLocked} className={inp(isLocked)}>
                  <option value="active">Aktiv</option>
                  <option value="inactive">Inaktiv</option>
                </select>
              </Field>
            </div>
          )}

          {tab === "beschreibung" && (
            <Field label="Kurzbeschreibung" className="w-full">
              <textarea rows={8} value={form.short_description_json ?? ""}
                onChange={(e) => set("short_description_json", e.target.value)}
                disabled={isLocked} placeholder="Beschreibungstext…"
                className={inp(isLocked) + " resize-none"} />
            </Field>
          )}

          {tab === "limits" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Limit-Min-Wert">
                <input type="number" value={form.limit_min_value ?? ""}
                  onChange={(e) => set("limit_min_value", e.target.value ? Number(e.target.value) : undefined)}
                  disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="Limit-Max-Wert">
                <input type="number" value={form.limit_max_value ?? ""}
                  onChange={(e) => set("limit_max_value", e.target.value ? Number(e.target.value) : undefined)}
                  disabled={isLocked} className={inp(isLocked)} />
              </Field>
            </div>
          )}

          {tab === "alarm" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Alarm-Meldung">
                <select value={form.alarm_enabled ?? 0} onChange={(e) => set("alarm_enabled", Number(e.target.value) as 0 | 1)}
                  disabled={isLocked} className={inp(isLocked)}>
                  <option value={0}>Nein</option>
                  <option value={1}>Ja</option>
                </select>
              </Field>
              <Field label="Alarm-Stufe">
                <input type="text" value={form.alarm_level_code ?? ""}
                  onChange={(e) => set("alarm_level_code", e.target.value)}
                  disabled={isLocked} className={inp(isLocked)} />
              </Field>
              <Field label="Alarm-Zeitpunkt">
                <input type="datetime-local" value={form.alarm_timestamp ?? ""}
                  onChange={(e) => set("alarm_timestamp", e.target.value)}
                  disabled={isLocked} className={inp(isLocked)} />
              </Field>
            </div>
          )}

          {tab === "technik" && (
            <Field label="Technische Details (JSON)" className="w-full">
              <textarea rows={8} value={form.detail_json ?? ""}
                onChange={(e) => set("detail_json", e.target.value)}
                disabled={isLocked} placeholder={'{\n  "unit": "°C",\n  "plcTag": "DB10.DBW2"\n}'}
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
                      <th className="pb-2 pr-3">Wertebereich</th>
                      <th className="pb-2 pr-3">Einheit</th>
                      {!isLocked && <th className="pb-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map((v) => (
                      <tr key={v.name} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-3 font-medium text-blue-700">{v.name}</td>
                        <td className="py-2 pr-3">{v.title}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-gray-400">{v.datablock ?? "—"}</td>
                        <td className="py-2 pr-3 text-gray-500">
                          {dataTypeList.find((t) => t.code === v.data_type)?.description ?? v.data_type}
                        </td>
                        <td className="py-2 pr-3 font-mono text-gray-500 text-xs">{v.offset ?? "—"}</td>
                        <td className="py-2 pr-3 text-gray-500">{v.range ?? "—"}</td>
                        <td className="py-2 pr-3 text-gray-500">{v.unit ?? "—"}</td>
                        {!isLocked && (
                          <td className="py-2">
                            <button onClick={() => handleDeleteVariable(v.name)}
                              className="text-xs text-red-500 hover:text-red-700">Löschen</button>
                          </td>
                        )}
                      </tr>
                    ))}
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
                  <Field label="Bezeichnung *">
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
                  <Field label="Wertebereich">
                    <input type="text" value={newVar.range}
                      onChange={(e) => setNewVar((p) => ({ ...p, range: e.target.value }))}
                      placeholder="0..100"
                      className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
                  </Field>
                  <Field label="Einheit">
                    <input type="text" value={newVar.unit}
                      onChange={(e) => setNewVar((p) => ({ ...p, unit: e.target.value }))}
                      placeholder="kW"
                      className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
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
            <p className="text-sm text-red-700">Wollen Sie den Datensatz wirklich löschen?</p>
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
