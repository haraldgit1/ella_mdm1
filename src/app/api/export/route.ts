import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { exportCsv, exportJson, type ExportType } from "@/lib/export/csv-export";

const VALID_TYPES: ExportType[] = ["projects", "devices", "alarms", "emails", "lookups"];

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as ExportType;
  const format = searchParams.get("format") ?? "csv";

  if (!VALID_TYPES.includes(type)) {
    return Response.json({ error: "Ungültiger Export-Typ" }, { status: 400 });
  }

  const filename = `ella_mdm_${type}_${new Date().toISOString().slice(0, 10)}`;

  if (format === "json") {
    const data = exportJson(type);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    });
  }

  const csv = exportCsv(type);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
