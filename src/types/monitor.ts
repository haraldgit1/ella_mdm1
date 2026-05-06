import type { ModifyStatus } from "./project";

export interface Monitor {
  project_name: string;
  monitor_name: string;
  title: string;
  status: "active" | "inactive";
  type?: string;
  datablock?: string;
  request_url?: string;
  response_file?: string;
  short_description?: string;
  detail_json?: string;
  create_user: string;
  create_timestamp: string;
  modify_user: string;
  modify_timestamp: string;
  modify_status: ModifyStatus;
  version: number;
}

export type MonitorInput = Pick<
  Monitor,
  | "project_name"
  | "monitor_name"
  | "title"
  | "status"
  | "type"
  | "datablock"
  | "request_url"
  | "response_file"
  | "short_description"
  | "detail_json"
>;

export interface MonitorVariable {
  project_name: string;
  monitor_name: string;
  name: string;
  title: string;
  datablock?: string;
  data_type: string;
  offset?: string;
  create_user: string;
  create_timestamp: string;
  modify_user: string;
  modify_timestamp: string;
  modify_status: ModifyStatus;
  version: number;
}

export type MonitorVariableInput = Pick<
  MonitorVariable,
  | "project_name" | "monitor_name" | "name"
  | "title" | "datablock" | "data_type" | "offset"
>;
