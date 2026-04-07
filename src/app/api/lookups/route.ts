import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/db";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const functionCode = searchParams.get("function");

  const db = getDb();

  if (functionCode) {
    const code = parseInt(functionCode, 10);
    if (isNaN(code)) {
      return Response.json({ error: "Ungültiger function-Parameter" }, { status: 400 });
    }

    const rows = db
      .prepare(
        `SELECT function_code, code, description, function_text
         FROM mdm_lookup
         WHERE function_code = ? AND modify_status != 'deleted'
         ORDER BY code`
      )
      .all(code);

    return Response.json(rows);
  }

  // Ohne Parameter: alle Lookup-Gruppen zurückgeben
  const rows = db
    .prepare(
      `SELECT function_code, code, description, function_text
       FROM mdm_lookup
       WHERE modify_status != 'deleted'
       ORDER BY function_code, code`
    )
    .all();

  return Response.json(rows);
}
