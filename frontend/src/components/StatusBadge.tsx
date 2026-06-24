import type { CameraStatus } from "../api/types";

const STYLES: Record<CameraStatus, string> = {
  ONLINE: "bg-green-500/15 text-green-400 ring-1 ring-green-500/40",
  OFFLINE: "bg-red-500/15 text-red-400 ring-1 ring-red-500/40",
  UNKNOWN: "bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/40",
};

const LABELS: Record<CameraStatus, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  UNKNOWN: "Unknown",
};

export function StatusBadge({ status }: { status: CameraStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "ONLINE" ? "bg-green-400" : status === "OFFLINE" ? "bg-red-400" : "bg-gray-400"}`} />
      {LABELS[status]}
    </span>
  );
}
