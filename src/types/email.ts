import type { ModifyStatus } from "./project";

export interface ProjectEmail {
  project_name: string;
  email_address: string;
  email_purpose?: string;
  is_active: 0 | 1;
  create_user: string;
  create_timestamp: string;
  modify_user: string;
  modify_timestamp: string;
  modify_status: ModifyStatus;
}
