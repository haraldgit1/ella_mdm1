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

function Cell({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 leading-none">
        {label}
      </span>
      <span className="rounded bg-white/70 border border-gray-200 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 leading-none">
        {value ?? "—"}
      </span>
    </div>
  );
}

export default function AuditInfo({
  create_user, create_timestamp,
  modify_user, modify_timestamp,
  modify_status, version,
}: AuditInfoProps) {
  if (!create_user && !modify_user) return null;

  const editStatusStyle = EDIT_STATUS_STYLE[modify_status ?? ""] ?? "bg-gray-100 text-gray-500";
  const editStatusLabel = EDIT_STATUS_LABEL[modify_status ?? ""] ?? modify_status ?? "—";

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50 px-4 py-2.5">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <Cell label="Erstellt von"   value={create_user} />
        <Cell label="Erstellt am"    value={create_timestamp} />
        <div className="hidden h-8 w-px bg-gray-200 sm:block" />
        <Cell label="Geändert von"   value={modify_user} />
        <Cell label="Geändert am"    value={modify_timestamp} />
        <div className="hidden h-8 w-px bg-gray-200 sm:block" />
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 leading-none">
            Bearb.-Status
          </span>
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${editStatusStyle}`}>
            {editStatusLabel}
          </span>
        </div>
        <Cell label="Version" value={version} />
      </div>
    </div>
  );
}
