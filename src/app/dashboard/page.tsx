"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";

const NAV_ITEMS = [
  { label: "Projekte",   href: "/projects",   icon: "🗂" },
  { label: "Alarme",     href: "/alarms",     icon: "🔔" },
  { label: "Devices",    href: "/devices",    icon: "📡" },
  { label: "Variablen",  href: "/variables",  icon: "📋" },
  { label: "Reports",    href: "/reports",    icon: "📊" },
  { label: "Import",     href: "/import",     icon: "📥" },
  { label: "Export",     href: "/export",     icon: "📤" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Laden…</p>
      </div>
    );
  }

  if (!session) {
    router.replace("/login");
    return null;
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Ella MDM</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user.email}</span>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Abmelden
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 p-8">
        <p className="text-xl font-medium text-gray-700">
          Willkommen, {session.user.name}
        </p>

        <nav className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white px-8 py-6 shadow-sm transition hover:border-blue-400 hover:shadow-md"
            >
              <span className="text-3xl">{item.icon}</span>
              <span className="text-sm font-medium text-gray-800">{item.label}</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
