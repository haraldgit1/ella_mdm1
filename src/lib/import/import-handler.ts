import { getDb } from "@/lib/db/db";
import { auditInsert, auditUpdate } from "@/lib/audit/audit";
import { parseCsv } from "./csv-parser";

export type ImportType = "projects" | "devices" | "alarms" | "emails" | "lookups" | "variables" | "monitor_variables";

export interface ImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export function importCsv(type: ImportType, csvText: string, user: string): ImportResult {
  const rows = parseCsv(csvText);
  const result: ImportResult = { imported: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-based + header
    try {
      const changed = importRow(type, rows[i], user);
      if (changed === "inserted") result.imported++;
      else result.updated++;
    } catch (e: unknown) {
      result.errors.push({ row: rowNum, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return result;
}

function importRow(type: ImportType, row: Record<string, string>, user: string): "inserted" | "updated" {
  const db = getDb();

  switch (type) {
    case "projects": {
      if (!row.project_name) throw new Error("project_name fehlt");
      if (!row.title)        throw new Error("title fehlt");
      const existing = db.prepare("SELECT 1 FROM mdm_project WHERE project_name=?").get(row.project_name);
      if (existing) {
        const a = auditUpdate(user);
        db.prepare(
          `UPDATE mdm_project SET title=@title, short_description=@short_description,
           project_type_code=@project_type_code, street=@street, house_no=@house_no,
           postal_code=@postal_code, city=@city, country=@country,
           primary_ip_address=@primary_ip_address, secondary_ip_address=@secondary_ip_address,
           alarm_interval_sec=@alarm_interval_sec, alarm_count_limit=@alarm_count_limit,
           modify_user=@modify_user, modify_timestamp=@modify_timestamp, modify_status=@modify_status
           WHERE project_name=@project_name`
        ).run({ ...nullify(row), ...a });
        return "updated";
      }
      const a = auditInsert(user);
      db.prepare(
        `INSERT INTO mdm_project (project_name,title,short_description,project_type_code,
         street,house_no,postal_code,city,country,primary_ip_address,secondary_ip_address,
         alarm_interval_sec,alarm_count_limit,create_user,create_timestamp,
         modify_user,modify_timestamp,modify_status)
         VALUES (@project_name,@title,@short_description,@project_type_code,
         @street,@house_no,@postal_code,@city,@country,@primary_ip_address,@secondary_ip_address,
         @alarm_interval_sec,@alarm_count_limit,@create_user,@create_timestamp,
         @modify_user,@modify_timestamp,@modify_status)`
      ).run({ ...nullify(row), ...a });
      return "inserted";
    }

    case "devices": {
      if (!row.project_name) throw new Error("project_name fehlt");
      if (!row.device_name)  throw new Error("device_name fehlt");
      if (!row.title)        throw new Error("title fehlt");
      if (!row.device_type_code) throw new Error("device_type_code fehlt");
      const existing = db.prepare(
        "SELECT 1 FROM mdm_device WHERE project_name=? AND device_name=?"
      ).get(row.project_name, row.device_name);
      if (existing) {
        const a = auditUpdate(user);
        db.prepare(
          `UPDATE mdm_device SET title=@title, device_type_code=@device_type_code,
           status=@status, limit_min_value=@limit_min_value, limit_max_value=@limit_max_value,
           alarm_enabled=@alarm_enabled, alarm_level_code=@alarm_level_code,
           modify_user=@modify_user, modify_timestamp=@modify_timestamp, modify_status=@modify_status
           WHERE project_name=@project_name AND device_name=@device_name`
        ).run({ ...nullify(row), status: row.status || "active", alarm_enabled: row.alarm_enabled === "1" ? 1 : 0, ...a });
        return "updated";
      }
      const a = auditInsert(user);
      db.prepare(
        `INSERT INTO mdm_device (project_name,device_name,title,device_type_code,status,
         limit_min_value,limit_max_value,alarm_enabled,alarm_level_code,
         create_user,create_timestamp,modify_user,modify_timestamp,modify_status)
         VALUES (@project_name,@device_name,@title,@device_type_code,@status,
         @limit_min_value,@limit_max_value,@alarm_enabled,@alarm_level_code,
         @create_user,@create_timestamp,@modify_user,@modify_timestamp,@modify_status)`
      ).run({ ...nullify(row), status: row.status || "active", alarm_enabled: row.alarm_enabled === "1" ? 1 : 0, ...a });
      return "inserted";
    }

    case "alarms": {
      if (!row.project_name)     throw new Error("project_name fehlt");
      if (!row.alarm_level_code) throw new Error("alarm_level_code fehlt");
      if (!row.alarm_text)       throw new Error("alarm_text fehlt");
      const existing = db.prepare(
        "SELECT 1 FROM mdm_project_alarm WHERE project_name=? AND alarm_level_code=?"
      ).get(row.project_name, row.alarm_level_code);
      if (existing) {
        const a = auditUpdate(user);
        db.prepare(
          `UPDATE mdm_project_alarm SET alarm_text=@alarm_text, severity_rank=@severity_rank,
           modify_user=@modify_user, modify_timestamp=@modify_timestamp, modify_status=@modify_status
           WHERE project_name=@project_name AND alarm_level_code=@alarm_level_code`
        ).run({ ...nullify(row), ...a });
        return "updated";
      }
      const a = auditInsert(user);
      db.prepare(
        `INSERT INTO mdm_project_alarm (project_name,alarm_level_code,alarm_text,severity_rank,
         create_user,create_timestamp,modify_user,modify_timestamp,modify_status)
         VALUES (@project_name,@alarm_level_code,@alarm_text,@severity_rank,
         @create_user,@create_timestamp,@modify_user,@modify_timestamp,@modify_status)`
      ).run({ ...nullify(row), ...a });
      return "inserted";
    }

    case "emails": {
      if (!row.project_name)  throw new Error("project_name fehlt");
      if (!row.email_address) throw new Error("email_address fehlt");
      const existing = db.prepare(
        "SELECT 1 FROM mdm_project_email WHERE project_name=? AND email_address=?"
      ).get(row.project_name, row.email_address);
      if (existing) {
        const a = auditUpdate(user);
        db.prepare(
          `UPDATE mdm_project_email SET email_purpose=@email_purpose, is_active=@is_active,
           modify_user=@modify_user, modify_timestamp=@modify_timestamp, modify_status=@modify_status
           WHERE project_name=@project_name AND email_address=@email_address`
        ).run({ ...nullify(row), is_active: row.is_active === "0" ? 0 : 1, ...a });
        return "updated";
      }
      const a = auditInsert(user);
      db.prepare(
        `INSERT INTO mdm_project_email (project_name,email_address,email_purpose,is_active,
         create_user,create_timestamp,modify_user,modify_timestamp,modify_status)
         VALUES (@project_name,@email_address,@email_purpose,@is_active,
         @create_user,@create_timestamp,@modify_user,@modify_timestamp,@modify_status)`
      ).run({ ...nullify(row), is_active: row.is_active === "0" ? 0 : 1, ...a });
      return "inserted";
    }

    case "lookups": {
      if (!row.function_code) throw new Error("function_code fehlt");
      if (!row.code)          throw new Error("code fehlt");
      if (!row.description)   throw new Error("description fehlt");
      const existing = db.prepare(
        "SELECT 1 FROM mdm_lookup WHERE function_code=? AND code=?"
      ).get(Number(row.function_code), row.code);
      if (existing) {
        const a = auditUpdate(user);
        db.prepare(
          `UPDATE mdm_lookup SET description=@description, function_text=@function_text,
           modify_user=@modify_user, modify_timestamp=@modify_timestamp, modify_status=@modify_status
           WHERE function_code=@function_code AND code=@code`
        ).run({ ...nullify(row), function_code: Number(row.function_code), ...a });
        return "updated";
      }
      const a = auditInsert(user);
      db.prepare(
        `INSERT INTO mdm_lookup (function_code,code,description,function_text,
         create_user,create_timestamp,modify_user,modify_timestamp,modify_status)
         VALUES (@function_code,@code,@description,@function_text,
         @create_user,@create_timestamp,@modify_user,@modify_timestamp,@modify_status)`
      ).run({ ...nullify(row), function_code: Number(row.function_code), ...a });
      return "inserted";
    }

    case "variables": {
      if (!row.project_name) throw new Error("project_name fehlt");
      if (!row.device_name)  throw new Error("device_name fehlt");
      if (!row.name)         throw new Error("name fehlt");
      if (!row.title)        throw new Error("title fehlt");
      if (!row.data_type)    throw new Error("data_type fehlt");
      const existing = db.prepare(
        "SELECT 1 FROM mdm_device_variable WHERE project_name=? AND device_name=? AND name=?"
      ).get(row.project_name, row.device_name, row.name);
      if (existing) {
        const a = auditUpdate(user);
        db.prepare(
          `UPDATE mdm_device_variable SET title=@title, datablock=@datablock, data_type=@data_type,
           offset=@offset, range=@range, unit=@unit,
           modify_user=@modify_user, modify_timestamp=@modify_timestamp, modify_status=@modify_status
           WHERE project_name=@project_name AND device_name=@device_name AND name=@name`
        ).run({ ...nullify(row), ...a });
        return "updated";
      }
      const a = auditInsert(user);
      db.prepare(
        `INSERT INTO mdm_device_variable (project_name,device_name,name,title,datablock,data_type,
         offset,range,unit,create_user,create_timestamp,modify_user,modify_timestamp,modify_status,version)
         VALUES (@project_name,@device_name,@name,@title,@datablock,@data_type,
         @offset,@range,@unit,@create_user,@create_timestamp,@modify_user,@modify_timestamp,@modify_status,@version)`
      ).run({ ...nullify(row), ...a });
      return "inserted";
    }

    case "monitor_variables": {
      if (!row.project_name) throw new Error("project_name fehlt");
      if (!row.monitor_name) throw new Error("monitor_name fehlt");
      if (!row.name)         throw new Error("name fehlt");
      if (!row.data_type)    throw new Error("data_type fehlt");
      const existing = db.prepare(
        "SELECT 1 FROM mdm_monitor_variable WHERE project_name=? AND monitor_name=? AND name=?"
      ).get(row.project_name, row.monitor_name, row.name);
      if (existing) {
        const a = auditUpdate(user);
        db.prepare(
          `UPDATE mdm_monitor_variable SET title=@title, datablock=@datablock, data_type=@data_type,
           offset=@offset,
           modify_user=@modify_user, modify_timestamp=@modify_timestamp, modify_status=@modify_status
           WHERE project_name=@project_name AND monitor_name=@monitor_name AND name=@name`
        ).run({ ...nullify(row), ...a });
        return "updated";
      }
      const a = auditInsert(user);
      db.prepare(
        `INSERT INTO mdm_monitor_variable (project_name,monitor_name,name,title,datablock,data_type,
         offset,create_user,create_timestamp,modify_user,modify_timestamp,modify_status,version)
         VALUES (@project_name,@monitor_name,@name,@title,@datablock,@data_type,
         @offset,@create_user,@create_timestamp,@modify_user,@modify_timestamp,@modify_status,1)`
      ).run({ ...nullify(row), ...a });
      return "inserted";
    }
  }
}

/** Convert empty strings to null for optional fields */
function nullify(row: Record<string, string>): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v === "" ? null : v])
  );
}
