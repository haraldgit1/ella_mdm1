import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";

function isAdmin(session: { user: { role?: string | null } } | null): boolean {
  return session?.user?.role === "admin";
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!isAdmin(session)) return Response.json({ error: "Nur Admins erlaubt" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (auth.api as any).listUsers({
    query: { limit: 500, sortBy: "createdAt", sortDirection: "desc" },
    headers: request.headers,
  });
  return Response.json(result);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!isAdmin(session)) return Response.json({ error: "Nur Admins erlaubt" }, { status: 403 });

  const body = await request.json();
  const { name, email, password, role } = body;

  if (!name?.trim()) return Response.json({ error: "Name ist Pflichtfeld" }, { status: 400 });
  if (!email?.trim()) return Response.json({ error: "E-Mail ist Pflichtfeld" }, { status: 400 });
  if (!password?.trim()) return Response.json({ error: "Passwort ist Pflichtfeld" }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "Passwort muss mindestens 8 Zeichen haben" }, { status: 400 });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (auth.api as any).createUser({
      body: { name, email, password, role: role ?? "user" },
      headers: request.headers,
    });
    return Response.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("unique")) {
      return Response.json({ error: "E-Mail bereits vorhanden" }, { status: 409 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
