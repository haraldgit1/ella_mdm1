export function auditInsert(user: string) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  return {
    create_user: user,
    create_timestamp: now,
    modify_user: user,
    modify_timestamp: now,
    modify_status: "inserted" as const,
  };
}

export function auditUpdate(user: string) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  return {
    modify_user: user,
    modify_timestamp: now,
    modify_status: "updated" as const,
  };
}

export function auditLock(user: string) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  return {
    modify_user: user,
    modify_timestamp: now,
    modify_status: "locked" as const,
  };
}

export function auditDelete(user: string) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  return {
    modify_user: user,
    modify_timestamp: now,
    modify_status: "deleted" as const,
  };
}
