"use client";

import { useState } from "react";
import Link from "next/link";

type ExportType = "projects" | "devices" | "alarms" | "emails" | "lookups";
type ExportFormat = "csv" | "json";

const TYPE_OPTIONS: { value: ExportType; label: string }[] = [
  { value: "projects", label: "Projekte" },
  { value: "devices",  label: "Devices" },
  { value: "alarms",   label: "Alarmstufen" },
  { value: "emails",   label: "Ziel-E-Mails" },
  { value: "lookups",  label: "Lookup-Werte" },
];

export default function ExportPage() {
  const [type, setType] = useState<ExportType>("projects");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    const res = await fetch(`/api/export?type=${type}&format=${format}`);
    if (!res.ok) { setLoading(false); return; }

    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const nameMatch = disposition.match(/filename="([^"]+)"/);
    const filename = nameMatch?.[1] ?? `export_${type}.${format}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
        <h1 className="text-lg font-semibold text-gray-900">Export</h1>
      </header>

      <main className="p-6 max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white p-6 flex flex-col gap-5">
          {/* Typ */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Export-Objekt</label>
            <select value={type} onChange={(e) => setType(e.target.value as ExportType)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Format */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Format</label>
            <div className="flex gap-4">
              {(["csv", "json"] as ExportFormat[]).map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="format" value={f} checked={format === f}
                    onChange={() => setFormat(f)}
                    className="accent-blue-600" />
                  {f.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          <button onClick={handleExport} disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Wird erstellt…" : "Herunterladen"}
          </button>
        </div>
      </main>
    </div>
  );
}
