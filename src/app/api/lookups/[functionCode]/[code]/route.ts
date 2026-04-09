import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditUpdate, auditDelete } from "@/lib/audit/audit";

type Params = { params: Promise<{ functionCode: string; code: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { functionCode, code } = await params;
  const fc = parseInt(functionCode, 10);
  if (isNaN(fc)) return Response.json({ error: "Ungültiger function_code" }, { status: 400 });

  const body: { description?: string; function_text?: string } = await request.json();
  if (!body.description?.trim()) return Response.json({ error: "Beschreibung fehlt" }, { status: 400 });

  const audit = auditUpdate(session.user.email);

  const result = getDb().prepare(
    `UPDATE mdm_lookup
     SET description=@description, function_text=@function_text,
         modify_user=@modify_user, modify_timestamp=@modify_timestamp,
         modify_status=@modify_status, version=version+1
     WHERE function_code=@function_code AND code=@code AND modify_status != 'deleted'`
  ).run({
    function_code: fc,
    code: decodeURIComponent(code),
    description: body.description.trim(),
    function_text: body.function_text?.trim() || null,
    ...audit,
  });

  if (result.changes === 0) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { functionCode, code } = await params;
  const fc = parseInt(functionCode, 10);
  if (isNaN(fc)) return Response.json({ error: "Ungültiger function_code" }, { status: 400 });

  const audit = auditDelete(session.user.email);

  const result = getDb().prepare(
    `UPDATE mdm_lookup
     SET modify_user=@modify_user, modify_timestamp=@modify_timestamp,
         modify_status=@modify_status, version=version+1
     WHERE function_code=@function_code AND code=@code AND modify_status != 'deleted'`
  ).run({ function_code: fc, code: decodeURIComponent(code), ...audit });

  if (result.changes === 0) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  return Response.json({ ok: true });
}
