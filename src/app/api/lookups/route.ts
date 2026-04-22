import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";
import { auditInsert } from "@/lib/audit/audit";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const functionCode  = searchParams.get("function");
  const functionText  = searchParams.get("function_text") ?? "";
  const code          = searchParams.get("code")          ?? "";
  const description   = searchParams.get("description")   ?? "";

  const db = getDb();

  // Einfacher Dropdown-Abruf per function=<code>
  if (functionCode && !functionText && !code && !description) {
    const fc = parseInt(functionCode, 10);
    if (isNaN(fc)) return Response.json({ error: "Ungültiger function-Parameter" }, { status: 400 });
    const rows = db.prepare(
      `SELECT function_code, code, description, function_text
       FROM mdm_lookup WHERE function_code = ? AND modify_status != 'deleted' ORDER BY code`
    ).all(fc);
    return Response.json(rows);
  }

  // Volltext-Suche für Stammdaten-Programm
  const conditions: string[] = ["modify_status != 'deleted'"];
  const params: unknown[] = [];
  if (functionCode)  { conditions.push("function_code = ?");        params.push(Number(functionCode)); }
  if (functionText)  { conditions.push("function_text LIKE ?");     params.push(`%${functionText}%`); }
  if (code)          { conditions.push("code LIKE ?");               params.push(`%${code}%`); }
  if (description)   { conditions.push("description LIKE ?");        params.push(`%${description}%`); }

  const rows = db.prepare(
    `SELECT function_code, code, description, function_text,
            create_user, create_timestamp, modify_user, modify_timestamp, modify_status, version
     FROM mdm_lookup
     WHERE ${conditions.join(" AND ")}
     ORDER BY function_code, code`
  ).all(...params);

  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body: { function_code: number; code: string; description: string; function_text?: string } =
    await request.json();

  if (!body.function_code)      return Response.json({ error: "Function-Code fehlt" }, { status: 400 });
  if (!body.code?.trim())       return Response.json({ error: "Code fehlt" }, { status: 400 });
  if (!body.description?.trim())return Response.json({ error: "Beschreibung fehlt" }, { status: 400 });

  const audit = auditInsert(session.user.email);

  try {
    getDb().prepare(
      `INSERT INTO mdm_lookup
        (function_code, code, description, function_text,
         create_user, create_timestamp, modify_user, modify_timestamp, modify_status, version)
       VALUES
        (@function_code, @code, @description, @function_text,
         @create_user, @create_timestamp, @modify_user, @modify_timestamp, @modify_status, @version)`
    ).run({ ...body, function_text: body.function_text?.trim() || null, ...audit });
    return Response.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fehler";
    if (msg.includes("UNIQUE")) return Response.json({ error: "Eintrag bereits vorhanden" }, { status: 409 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
