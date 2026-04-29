import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";

function isAdmin(session: { user: { role?: string | null } } | null): boolean {
  return session?.user?.role === "admin";
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!isAdmin(session)) return Response.json({ error: "Nur Admins erlaubt" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { name, email, role, action } = body;

  try {
    if (action === "ban") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (auth.api as any).banUser({ body: { userId: id }, headers: request.headers });
      return Response.json({ ok: true });
    }

    if (action === "unban") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (auth.api as any).unbanUser({ body: { userId: id }, headers: request.headers });
      return Response.json({ ok: true });
    }

    // Update name / email / role
    const data: Record<string, string> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;

    if (Object.keys(data).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (auth.api as any).adminUpdateUser({
        body: { userId: id, data },
        headers: request.headers,
      });
    }

    if (role !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (auth.api as any).setRole({
        body: { userId: id, role },
        headers: request.headers,
      });
    }

    return Response.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!isAdmin(session)) return Response.json({ error: "Nur Admins erlaubt" }, { status: 403 });

  const { id } = await params;

  if (session.user.id === id) {
    return Response.json({ error: "Sie können sich nicht selbst löschen" }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (auth.api as any).removeUser({ body: { userId: id }, headers: request.headers });
    return Response.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
