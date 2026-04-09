interface AuditInfoProps {
  create_user?: string;
  create_timestamp?: string;
  modify_user?: string;
  modify_timestamp?: string;
  modify_status?: string;
  version?: number;
}

const STATUS_LABEL: Record<string, string> = {
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

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500 font-mono">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <span><span className="font-semibold text-gray-400">Erstellt:</span> {create_user} &nbsp;{create_timestamp}</span>
        <span><span className="font-semibold text-gray-400">Geändert:</span> {modify_user} &nbsp;{modify_timestamp}</span>
        <span><span className="font-semibold text-gray-400">Status:</span> {STATUS_LABEL[modify_status ?? ""] ?? modify_status}</span>
        <span><span className="font-semibold text-gray-400">Version:</span> {version}</span>
      </div>
    </div>
  );
}
