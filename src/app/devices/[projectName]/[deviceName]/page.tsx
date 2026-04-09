"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Device } from "@/types/device";
import AuditInfo from "@/components/AuditInfo";

type Tab = "allgemein" | "beschreibung" | "limits" | "alarm" | "technik";

const TABS: { key: Tab; label: string }[] = [
  { key: "allgemein",    label: "Allgemein" },
  { key: "beschreibung", label: "Beschreibung" },
  { key: "limits",       label: "Limits" },
  { key: "alarm",        label: "Alarm" },
  { key: "technik",      label: "Technische Daten" },
];

const EMPTY: Partial<Device> = {
  project_name: "", device_name: "", title: "", device_type_code: "",
  status: "active", alarm_enabled: 0,
  short_description_json: "", detail_json: "",
};

export default function DeviceDetailPage({
  params,
}: {
  params: Promise<{ projectName: string; deviceName: string }>;
}) {
  const { projectName, deviceName } = use(params);
  const isNew = projectName === "new" && deviceName === "new";
  const searchParams = useSearchParams();
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

  const isLocked = form.modify_status === "locked";

  useEffect(() => {
    if (isNew || isCopy) {
      Promise.all([
        fetch("/api/projects").then((r) => r.json()),
        fetch("/api/lookups?function=100").then((r) => r.json()),
      ]).then(([projects, types]) => {
        setProjectList(Array.isArray(projects) ? projects : []);
        setDeviceTypeList(Array.isArray(types) ? types : []);
      });
    }
    if (isNew && !isCopy) { setLoading(false); return; }
    fetch(`/api/devices/${encodeURIComponent(projectName)}/${encodeURIComponent(deviceName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (isCopy) {
          setForm({ ...data, device_name: `${data.device_name}_KOPIE`, modify_status: undefined });
        } else {
          setForm(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectName, deviceName, isNew, isCopy]);

  function set(field: keyof Device, value: string | number | undefined) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setError("");
    const actAsNew = isNew || isCopy;
    if (actAsNew && form.device_name && !/^[A-Za-z0-9_-]+$/.test(form.device_name)) {
      setError("DeviceName darf nur Buchstaben (A-Z), Ziffern, Bindestrich und Unterstrich enthalten (keine Umlaute oder Sonderzeichen)");
      return;
    }
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
    if (actAsNew) router.replace(`/devices/${encodeURIComponent(data.project_name)}/${encodeURIComponent(data.device_name)}`);
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
    router.push(`/devices/${encodeURIComponent(projectName)}/${encodeURIComponent(deviceName)}?copy=1`);
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
                {(isNew || isCopy) ? (
                  <select value={form.device_type_code ?? ""} onChange={(e) => set("device_type_code", e.target.value)}
                    disabled={isLocked} className={inp(isLocked)}>
                    <option value="">— bitte wählen —</option>
                    {deviceTypeList.map((t) => (
                      <option key={t.code} value={t.code}>{t.description}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={form.device_type_code ?? ""} disabled className={inp(true)} />
                )}
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

        {/* Aktionsbuttons */}
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
