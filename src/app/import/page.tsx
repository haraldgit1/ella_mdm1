"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type ImportType = "projects" | "devices" | "alarms" | "emails" | "lookups" | "variables";

const TYPE_OPTIONS: { value: ImportType; label: string }[] = [
  { value: "projects",  label: "Projekte" },
  { value: "devices",   label: "Devices" },
  { value: "alarms",    label: "Alarmstufen" },
  { value: "emails",    label: "Ziel-E-Mails" },
  { value: "lookups",   label: "Lookup-Werte" },
  { value: "variables", label: "Variablen" },
];

const TEMPLATES: Record<ImportType, string> = {
  projects:  "project_name,title,short_description,project_type_code,street,house_no,postal_code,city,country,primary_ip_address,secondary_ip_address,alarm_interval_sec,alarm_count_limit\nProjekt1,Bezeichnung 1,,,,,,,,,,,",
  devices:   "project_name,device_name,title,device_type_code,status,limit_min_value,limit_max_value,alarm_enabled,alarm_level_code\nProjekt1,Device1,Bezeichnung,1,active,,,0,",
  alarms:    "project_name,alarm_level_code,alarm_text,severity_rank\nProjekt1,ALM1,Alarm-Text,1",
  emails:    "project_name,email_address,email_purpose,is_active\nProjekt1,mail@example.com,Alarm,1",
  lookups:   "function_code,code,description,function_text\n100,6,Pumpe2,DeviceType",
  variables: "project_name,device_name,name,title,datablock,data_type,offset,range,unit\nProjekt1,Device1,Leistung,Aktuelle Leistung,DB10,3,DB10.DBD0,0..2500,kW",
};

interface ImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export default function ImportPage() {
  const [type, setType] = useState<ImportType>("projects");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [apiError, setApiError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATES[type]], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);
    setApiError("");

    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);

    const res = await fetch("/api/import", { method: "POST", body: formData });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setApiError(data.error ?? "Fehler"); return; }
    setResult(data);
    // Reset file input
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
        <h1 className="text-lg font-semibold text-gray-900">CSV-Import</h1>
      </header>

      <main className="flex flex-col gap-6 p-6 max-w-2xl">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Typ */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Import-Typ</label>
              <select value={type} onChange={(e) => setType(e.target.value as ImportType)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Template */}
            <button type="button" onClick={downloadTemplate}
              className="self-start rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Template herunterladen
            </button>

            {/* Datei */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">CSV-Datei</label>
              <input ref={fileRef} type="file" accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-blue-700" />
            </div>

            {apiError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</p>}

            <button type="submit" disabled={loading || !file}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Importiert…" : "Import starten"}
            </button>
          </form>
        </div>

        {/* Ergebnis */}
        {result && (
          <div className={`rounded-xl border p-6 ${
            result.errors.length === 0 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"
          }`}>
            <h2 className="mb-3 text-sm font-semibold text-gray-800">Import-Ergebnis</h2>
            <div className="flex gap-6 text-sm">
              <span className="text-green-700"><strong>{result.imported}</strong> neu importiert</span>
              <span className="text-blue-700"><strong>{result.updated}</strong> aktualisiert</span>
              {result.errors.length > 0 && (
                <span className="text-red-700"><strong>{result.errors.length}</strong> Fehler</span>
              )}
            </div>

            {result.errors.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1">
                {result.errors.map((err) => (
                  <li key={err.row} className="text-xs text-red-700">
                    Zeile {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
