import type { ModifyStatus } from "./project";

export interface Device {
  project_name: string;
  device_name: string;
  title: string;
  device_type_code: string;
  status: "active" | "inactive";
  short_description_json?: string;
  limit_min_value?: number;
  limit_max_value?: number;
  alarm_enabled: 0 | 1;
  alarm_timestamp?: string;
  alarm_level_code?: string;
  detail_json?: string;
  create_user: string;
  create_timestamp: string;
  modify_user: string;
  modify_timestamp: string;
  modify_status: ModifyStatus;
  version: number;
}

export type DeviceInput = Pick<
  Device,
  | "project_name"
  | "device_name"
  | "title"
  | "device_type_code"
  | "status"
  | "short_description_json"
  | "limit_min_value"
  | "limit_max_value"
  | "alarm_enabled"
  | "alarm_timestamp"
  | "alarm_level_code"
  | "detail_json"
>;
