import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";

function isAdmin(session: { user: { role?: string | null } } | null): boolean {
  return session?.user?.role === "admin";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!isAdmin(session)) return Response.json({ error: "Nur Admins erlaubt" }, { status: 403 });

  const { id } = await params;
  const { newPassword } = await request.json();

  if (!newPassword?.trim()) return Response.json({ error: "Passwort ist Pflichtfeld" }, { status: 400 });
  if (newPassword.length < 8) return Response.json({ error: "Passwort muss mindestens 8 Zeichen haben" }, { status: 400 });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (auth.api as any).setUserPassword({
      body: { userId: id, newPassword },
      headers: request.headers,
    });
    return Response.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
