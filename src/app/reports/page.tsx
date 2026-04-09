"use client";

import Link from "next/link";

export default function ReportsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← Dashboard
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Reports</h1>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-400">Reports – in Entwicklung</p>
      </main>
    </div>
  );
}
