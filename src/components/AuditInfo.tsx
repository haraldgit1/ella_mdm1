interface AuditInfoProps {
  create_user?: string;
  create_timestamp?: string;
  modify_user?: string;
  modify_timestamp?: string;
  modify_status?: string;
  version?: number;
}

const EDIT_STATUS_STYLE: Record<string, string> = {
  inserted: "bg-emerald-100 text-emerald-700",
  updated:  "bg-blue-100 text-blue-700",
  locked:   "bg-amber-100 text-amber-700",
  deleted:  "bg-red-100 text-red-700",
};

const EDIT_STATUS_LABEL: Record<string, string> = {
  inserted: "Neu",
  updated:  "Geändert",
  locked:   "Gesperrt",
  deleted:  "Gelöscht",
};

export default function AuditInfo({
  create_user, create_timestamp,
  modify_user, modify_timestamp,
  modify_status, version,
}: AuditInfoProps) {
  if (!create_user && !modify_user) return null;

  const editStatusStyle = EDIT_STATUS_STYLE[modify_status ?? ""] ?? "bg-gray-100 text-gray-500";
  const editStatusLabel = EDIT_STATUS_LABEL[modify_status ?? ""] ?? modify_status ?? "—";

  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50 px-4 py-1.5 text-[10px] font-mono text-gray-500">
      <span>
        <span className="mr-1 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Erstellt:</span>
        {create_user} · {create_timestamp}
      </span>
      <span className="text-gray-300">|</span>
      <span>
        <span className="mr-1 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Geändert:</span>
        {modify_user} · {modify_timestamp}
      </span>
      <span className="text-gray-300">|</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${editStatusStyle}`}>
        {editStatusLabel}
      </span>
      <span className="text-gray-400">
        Version: <span className="font-semibold text-gray-600">{version}</span>
      </span>
    </div>
  );
}
