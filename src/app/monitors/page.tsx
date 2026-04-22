"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface MonitorRow {
  project_name: string;
  monitor_name: string;
  title: string;
  type?: string;
  status: "active" | "inactive";
  modify_status: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Aktiv",
  inactive: "Inaktiv",
};

const LAST_CLICKED_KEY = "monitors_last_clicked";

export default function MonitorsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState({
    project_name: searchParams.get("project_name") ?? "",
    monitor_name: searchParams.get("monitor_name") ?? "",
    title:        searchParams.get("title")        ?? "",
    type:         searchParams.get("type")         ?? "",
    status:       searchParams.get("status")       ?? "",
  });
  const [results, setResults] = useState<MonitorRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [monitorTypeList, setMonitorTypeList] = useState<{ code: string; description: string }[]>([]);

  useEffect(() => {
    fetch("/api/lookups?function=400")
      .then((r) => r.json())
      .then((data) => setMonitorTypeList(Array.isArray(data) ? data : []));
  }, []);

  function rowKey(row: MonitorRow) {
    return `${row.project_name}/${row.monitor_name}`;
  }

  useEffect(() => {
    if (searchParams.get("searched")) {
      const s = {
        project_name: searchParams.get("project_name") ?? "",
        monitor_name: searchParams.get("monitor_name") ?? "",
        title:        searchParams.get("title")        ?? "",
        type:         searchParams.get("type")         ?? "",
        status:       searchParams.get("status")       ?? "",
      };
      runSearch(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!searched) return;
    const lastClicked = sessionStorage.getItem(LAST_CLICKED_KEY);
    if (lastClicked && rowRefs.current[lastClicked]) {
      setHighlighted(lastClicked);
      rowRefs.current[lastClicked]?.scrollIntoView({ block: "center", behavior: "instant" });
      sessionStorage.removeItem(LAST_CLICKED_KEY);
    }
  }, [searched, results]);

  async function runSearch(s: typeof search) {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(s).forEach(([k, v]) => { if (v) params.set(k, v); });
    const res = await fetch(`/api/monitors?${params}`);
    const data = await res.json();
    setResults(Array.isArray(data) ? data : []);
    setSearched(true);
    setLoading(false);
  }

  function set(field: keyof typeof search, value: string) {
    setSearch((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    Object.entries(search).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.set("searched", "1");
    router.replace(`/monitors?${params}`);
    await runSearch(search);
  }

  function handleRowClick(row: MonitorRow) {
    setHighlighted(rowKey(row));
    sessionStorage.setItem(LAST_CLICKED_KEY, rowKey(row));
    router.push(`/monitors/${encodeURIComponent(row.project_name)}?monitor=${encodeURIComponent(row.monitor_name)}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
          <h1 className="text-lg font-semibold text-gray-900">Monitor Definitions</h1>
        </div>
        <button
          onClick={() => router.push("/monitors/new?monitor=new")}
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
            <SearchField label="ProjektName">
              <input type="text" value={search.project_name} onChange={(e) => set("project_name", e.target.value)}
                className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </SearchField>
            <SearchField label="MonitorName">
              <input type="text" value={search.monitor_name} onChange={(e) => set("monitor_name", e.target.value)}
                className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </SearchField>
            <SearchField label="Bezeichnung">
              <input type="text" value={search.title} onChange={(e) => set("title", e.target.value)}
                className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </SearchField>
            <SearchField label="Typ">
              <select value={search.type} onChange={(e) => set("type", e.target.value)}
                className="w-36 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value="">Alle</option>
                {monitorTypeList.map((t) => (
                  <option key={t.code} value={t.code}>{t.description}</option>
                ))}
              </select>
            </SearchField>
            <SearchField label="Status">
              <select value={search.status} onChange={(e) => set("status", e.target.value)}
                className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value="">Alle</option>
                <option value="active">Aktiv</option>
                <option value="inactive">Inaktiv</option>
              </select>
            </SearchField>
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
              <p className="p-6 text-sm text-gray-500">Keine Monitor Definitions gefunden.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">ProjektName</th>
                    <th className="px-4 py-3">MonitorName</th>
                    <th className="px-4 py-3">Bezeichnung</th>
                    <th className="px-4 py-3">Typ</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr
                      key={rowKey(row)}
                      ref={(el) => { rowRefs.current[rowKey(row)] = el; }}
                      onClick={() => handleRowClick(row)}
                      className={`cursor-pointer border-b border-gray-100 last:border-0 ${
                        highlighted === rowKey(row) ? "bg-blue-100" : "hover:bg-blue-50"
                      }`}
                    >
                      <td className={`px-4 py-3 ${highlighted === rowKey(row) ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                        {row.project_name}
                      </td>
                      <td className={`px-4 py-3 text-blue-700 ${highlighted === rowKey(row) ? "font-bold" : "font-medium"}`}>
                        {row.monitor_name}
                      </td>
                      <td className={`px-4 py-3 ${highlighted === rowKey(row) ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                        {row.title}
                      </td>
                      <td className="px-4 py-3">
                        {row.type ? (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.type === "2" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {monitorTypeList.find((t) => t.code === row.type)?.description ?? row.type}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.modify_status === "locked" ? (
                          <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Gesperrt</span>
                        ) : (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                          }`}>
                            {STATUS_LABEL[row.status] ?? row.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SearchField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}
