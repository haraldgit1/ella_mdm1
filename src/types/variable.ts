import type { ModifyStatus } from "./project";

export interface DeviceVariable {
  project_name: string;
  device_name: string;
  name: string;
  title: string;
  data_type: string;
  offset?: string;
  range?: string;
  unit?: string;
  detail_json?: string;
  create_user: string;
  create_timestamp: string;
  modify_user: string;
  modify_timestamp: string;
  modify_status: ModifyStatus;
  version: number;
}

export type DeviceVariableInput = Pick<
  DeviceVariable,
  | "project_name" | "device_name" | "name"
  | "title" | "data_type" | "offset" | "range" | "unit" | "detail_json"
>;
