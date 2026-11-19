import type { ApprovalStatus, RequestStatus } from "@prisma/client";

const PERSETUJUAN: Record<ApprovalStatus, [string, string]> = {
  DRAFT: ["Draft", "bg-slate-100 text-slate-700"],
  MENUNGGU_APPROVAL: ["Menunggu Approval", "bg-amber-100 text-amber-800"],
  DISETUJUI: ["Disetujui", "bg-emerald-100 text-emerald-800"],
  DITOLAK: ["Ditolak", "bg-red-100 text-red-700"],
};

const PERMINTAAN: Record<RequestStatus, [string, string]> = {
  OPEN: ["Open", "bg-blue-100 text-blue-800"],
  ON_HOLD: ["On Hold", "bg-orange-100 text-orange-800"],
  CANCELLED: ["Cancelled", "bg-slate-200 text-slate-700"],
  FILLED: ["Filled", "bg-emerald-100 text-emerald-800"],
};

export function ApprovalBadge({
  status,
  level,
  approverPeran,
}: {
  status: ApprovalStatus;
  level?: number | null;
  approverPeran?: string | null;
}) {
  const [label, cls] = PERSETUJUAN[status];
  const text = status === "MENUNGGU_APPROVAL" && level ? `Menunggu Approval ${level}${approverPeran ? ` – ${approverPeran}` : ""}` : label;
  return <span className={`badge ${cls}`}>{text}</span>;
}

export function RequestBadge({ status }: { status: RequestStatus | null }) {
  if (!status) return <span className="text-slate-400">—</span>;
  const [label, cls] = PERMINTAAN[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export const requestStatusLabel = (s: RequestStatus | null) => (s ? PERMINTAAN[s][0] : "—");
