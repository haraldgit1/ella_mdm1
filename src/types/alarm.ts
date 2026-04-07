import type { ModifyStatus } from "./project";

export interface ProjectAlarm {
  project_name: string;
  alarm_level_code: string;
  alarm_text: string;
  severity_rank?: number;
  create_user: string;
  create_timestamp: string;
  modify_user: string;
  modify_timestamp: string;
  modify_status: ModifyStatus;
}
