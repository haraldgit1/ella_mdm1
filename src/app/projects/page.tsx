"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ProjectRow {
  project_name: string;
  title: string;
  short_description?: string;
  project_type_code?: string;
  city?: string;
  modify_status: string;
}

const STATUS_LABEL: Record<string, string> = {
  inserted: "Aktiv",
  updated: "Aktiv",
  locked: "Gesperrt",
};

export default function ProjectsPage() {
  const router = useRouter();
  const [search, setSearch] = useState({
    project_name: "",
    title: "",
    city: "",
  });
  const [results, setResults] = useState<ProjectRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const params = new URLSearchParams();
    if (search.project_name) params.set("project_name", search.project_name);
    if (search.title) params.set("title", search.title);
    if (search.city) params.set("city", search.city);

    const res = await fetch(`/api/projects?${params}`);
    const data = await res.json();
    setResults(Array.isArray(data) ? data : []);
    setSearched(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Projekte</h1>
        </div>
        <button
          onClick={() => router.push("/projects/new")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Neuanlage
        </button>
      </header>

      <main className="flex flex-col gap-6 p-6">
        {/* Suchmaske */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Suche
          </h2>
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">ProjektName</label>
              <input
                type="text"
                value={search.project_name}
                onChange={(e) => setSearch({ ...search, project_name: e.target.value })}
                className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Bezeichnung</label>
              <input
                type="text"
                value={search.title}
                onChange={(e) => setSearch({ ...search, title: e.target.value })}
                className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Stadt</label>
              <input
                type="text"
                value={search.city}
                onChange={(e) => setSearch({ ...search, city: e.target.value })}
                className="w-36 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-gray-900 px-5 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {loading ? "Suche…" : "Suche"}
              </button>
            </div>
          </form>
        </div>

        {/* Ergebnisliste */}
        {searched && (
          <div className="rounded-xl border border-gray-200 bg-white">
            {results.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">Keine Projekte gefunden.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">ProjektName</th>
                    <th className="px-4 py-3">Bezeichnung</th>
                    <th className="px-4 py-3">Stadt</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr
                      key={row.project_name}
                      onClick={() => router.push(`/projects/${encodeURIComponent(row.project_name)}`)}
                      className="cursor-pointer border-b border-gray-100 hover:bg-blue-50 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-blue-700">{row.project_name}</td>
                      <td className="px-4 py-3 text-gray-700">{row.title}</td>
                      <td className="px-4 py-3 text-gray-500">{row.city ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.modify_status === "locked"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {STATUS_LABEL[row.modify_status] ?? row.modify_status}
                        </span>
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
