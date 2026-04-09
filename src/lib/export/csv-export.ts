import { toCsvLine } from "@/lib/import/csv-parser";
import { getDb } from "@/lib/db/db";

export type ExportType = "projects" | "devices" | "alarms" | "emails" | "lookups" | "variables";

export function exportCsv(type: ExportType): string {
  const db = getDb();

  switch (type) {
    case "projects": {
      const headers = ["project_name","title","short_description","project_type_code",
        "street","house_no","postal_code","city","country",
        "primary_ip_address","secondary_ip_address","alarm_interval_sec","alarm_count_limit",
        "modify_status"];
      const rows = db.prepare(
        `SELECT ${headers.join(",")} FROM mdm_project WHERE modify_status != 'deleted' ORDER BY project_name`
      ).all() as Record<string, unknown>[];
      return [toCsvLine(headers), ...rows.map((r) => toCsvLine(headers.map((h) => r[h] as string)))].join("\n");
    }

    case "devices": {
      const headers = ["project_name","device_name","title","device_type_code","status",
        "limit_min_value","limit_max_value","alarm_enabled","alarm_level_code","modify_status"];
      const rows = db.prepare(
        `SELECT ${headers.join(",")} FROM mdm_device WHERE modify_status != 'deleted' ORDER BY project_name, device_name`
      ).all() as Record<string, unknown>[];
      return [toCsvLine(headers), ...rows.map((r) => toCsvLine(headers.map((h) => r[h] as string)))].join("\n");
    }

    case "alarms": {
      const headers = ["project_name","alarm_level_code","alarm_text","severity_rank"];
      const rows = db.prepare(
        `SELECT ${headers.join(",")} FROM mdm_project_alarm WHERE modify_status != 'deleted' ORDER BY project_name, alarm_level_code`
      ).all() as Record<string, unknown>[];
      return [toCsvLine(headers), ...rows.map((r) => toCsvLine(headers.map((h) => r[h] as string)))].join("\n");
    }

    case "emails": {
      const headers = ["project_name","email_address","email_purpose","is_active"];
      const rows = db.prepare(
        `SELECT ${headers.join(",")} FROM mdm_project_email WHERE modify_status != 'deleted' ORDER BY project_name, email_address`
      ).all() as Record<string, unknown>[];
      return [toCsvLine(headers), ...rows.map((r) => toCsvLine(headers.map((h) => r[h] as string)))].join("\n");
    }

    case "lookups": {
      const headers = ["function_code","code","description","function_text"];
      const rows = db.prepare(
        `SELECT ${headers.join(",")} FROM mdm_lookup WHERE modify_status != 'deleted' ORDER BY function_code, code`
      ).all() as Record<string, unknown>[];
      return [toCsvLine(headers), ...rows.map((r) => toCsvLine(headers.map((h) => r[h] as string)))].join("\n");
    }

    case "variables": {
      const headers = ["project_name","device_name","name","title","datablock","data_type","offset","range","unit"];
      const rows = db.prepare(
        `SELECT ${headers.join(",")} FROM mdm_device_variable WHERE modify_status != 'deleted' ORDER BY project_name, device_name, name`
      ).all() as Record<string, unknown>[];
      return [toCsvLine(headers), ...rows.map((r) => toCsvLine(headers.map((h) => r[h] as string)))].join("\n");
    }
  }
}

export function exportJson(type: ExportType): unknown[] {
  const db = getDb();
  const queries: Record<ExportType, string> = {
    projects:  "SELECT * FROM mdm_project WHERE modify_status != 'deleted' ORDER BY project_name",
    devices:   "SELECT * FROM mdm_device WHERE modify_status != 'deleted' ORDER BY project_name, device_name",
    alarms:    "SELECT * FROM mdm_project_alarm WHERE modify_status != 'deleted' ORDER BY project_name",
    emails:    "SELECT * FROM mdm_project_email WHERE modify_status != 'deleted' ORDER BY project_name",
    lookups:   "SELECT * FROM mdm_lookup WHERE modify_status != 'deleted' ORDER BY function_code, code",
    variables: "SELECT * FROM mdm_device_variable WHERE modify_status != 'deleted' ORDER BY project_name, device_name, name",
  };
  return db.prepare(queries[type]).all();
}
