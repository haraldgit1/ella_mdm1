export interface MessageText {
  project_name: string;
  message_name: string;
  id: number;
  message_text: string;
  message_class: string | null;
  trigger_tag: string | null;
  trigger_bit: number | null;
  trigger_address: string | null;
  hmi_acknowledgment_tag: string | null;
  hmi_acknowledgment_bit: number | null;
  hmi_acknowledgment_address: string | null;
  report: number;
  create_user: string;
  create_timestamp: string;
  modify_user: string;
  modify_timestamp: string;
  modify_status: string;
  version: number;
}

export interface MessageTextInput {
  project_name: string;
  message_name: string;
  message_text: string;
  message_class?: string | null;
  trigger_tag?: string | null;
  trigger_bit?: number | null;
  trigger_address?: string | null;
  hmi_acknowledgment_tag?: string | null;
  hmi_acknowledgment_bit?: number | null;
  hmi_acknowledgment_address?: string | null;
  report?: number;
}
