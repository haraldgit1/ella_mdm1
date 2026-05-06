"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";

type NavItem = {
  label: string;
  icon: string;
  href?: string;       // aktiv wenn gesetzt
  planned?: boolean;   // Platzhalter
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Stammdaten",
    items: [
      { label: "Projekte",  icon: "🗂",  href: "/projects"  },
      { label: "Devices",   icon: "📡",  href: "/devices"   },
      { label: "Variablen",     icon: "📋",  href: "/variables"      },
      { label: "Meldungstexte", icon: "📝",  href: "/message-texts"  },
      { label: "Lookups",       icon: "🔖",  href: "/lookups"        },
    ],
  },
  {
    title: "Monitoring",
    items: [
      { label: "Monitors",       icon: "📟", href: "/monitors"        },
      { label: "E-Mail Dispatch", icon: "✉️",  href: "/email-dispatch" },
      { label: "Event Rules",    icon: "⚙️",  planned: true           },
      { label: "Events",         icon: "⚡",  planned: true           },
      { label: "Actions",        icon: "🎯",  planned: true           },
    ],
  },
  {
    title: "Integration & Sync",
    items: [
      { label: "Sync-Konfiguration",  icon: "🔗", planned: true },
      { label: "Datenmapping",        icon: "🗺",  planned: true },
      { label: "Export Queue",        icon: "📤", planned: true },
      { label: "Import Queue",        icon: "📥", planned: true },
      { label: "Sync-Historie",       icon: "🕓", planned: true },
      { label: "Verbindungsstatus",   icon: "🌐", planned: true },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Berichte",         icon: "📊", href: "/reports" },
      { label: "Monatsberichte",   icon: "📅", planned: true    },
      { label: "Event-Auswertung", icon: "📈", planned: true    },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Import CSV",         icon: "⬆️",  href: "/import" },
      { label: "Export CSV",         icon: "⬇️",  href: "/export" },
      { label: "Benutzer & Rollen",  icon: "👤", href: "/users"  },
      { label: "Setup",              icon: "⚙️",  href: "/setup"  },
      { label: "Kommunikation",      icon: "📡", planned: true   },
      { label: "Logging & Diagnose", icon: "🔍", planned: true   },
    ],
  },
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
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Ella Edge Integration Hub</h1>
          <p className="text-xs text-gray-400 mt-0.5">Local Edge Application</p>
        </div>
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

      <main className="flex flex-1 flex-col gap-8 p-8 max-w-5xl mx-auto w-full">
        <p className="text-lg font-medium text-gray-700">
          Willkommen, {session.user.name}
        </p>

        {NAV_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              {section.title}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {section.items.map((item) =>
                item.planned ? (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-5 opacity-50 cursor-not-allowed"
                    title="In Planung"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-xs font-medium text-gray-500 text-center leading-tight">{item.label}</span>
                    <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1">geplant</span>
                  </div>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href!}
                    className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-5 shadow-sm transition hover:border-blue-400 hover:shadow-md"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-xs font-medium text-gray-800 text-center leading-tight">{item.label}</span>
                  </Link>
                )
              )}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
