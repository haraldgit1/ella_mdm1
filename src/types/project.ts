export type ModifyStatus = "inserted" | "updated" | "locked" | "deleted";

export interface Project {
  project_name: string;
  title: string;
  short_description?: string;
  project_type_code?: string;
  street?: string;
  house_no?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  primary_ip_address?: string;
  secondary_ip_address?: string;
  alarm_interval_sec?: number;
  alarm_count_limit?: number;
  technical_json?: string;
  create_user: string;
  create_timestamp: string;
  modify_user: string;
  modify_timestamp: string;
  modify_status: ModifyStatus;
}

export type ProjectInput = Pick<
  Project,
  | "project_name"
  | "title"
  | "short_description"
  | "project_type_code"
  | "street"
  | "house_no"
  | "postal_code"
  | "city"
  | "country"
  | "primary_ip_address"
  | "secondary_ip_address"
  | "alarm_interval_sec"
  | "alarm_count_limit"
  | "technical_json"
>;
