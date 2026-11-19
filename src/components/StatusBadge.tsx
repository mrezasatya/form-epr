import type { ApprovalStatus, RequestStatus } from "@prisma/client";
import { approvalStatusText, REQUEST_STATUS_LABEL } from "@/lib/status-labels";

const PERSETUJUAN_CLS: Record<ApprovalStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  MENUNGGU_APPROVAL: "bg-amber-100 text-amber-800",
  DISETUJUI: "bg-emerald-100 text-emerald-800",
  DITOLAK: "bg-red-100 text-red-700",
};

const PERMINTAAN_CLS: Record<RequestStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  ON_HOLD: "bg-orange-100 text-orange-800",
  CANCELLED: "bg-slate-200 text-slate-700",
  FILLED: "bg-emerald-100 text-emerald-800",
};

export const PRIORITAS_CLS: Record<string, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-800",
  Low: "bg-slate-100 text-slate-700",
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
  return <span className={`badge ${PERSETUJUAN_CLS[status]}`}>{approvalStatusText(status, level, approverPeran)}</span>;
}

export function RequestBadge({ status }: { status: RequestStatus | null }) {
  if (!status) return <span className="text-slate-400">—</span>;
  return <span className={`badge ${PERMINTAAN_CLS[status]}`}>{REQUEST_STATUS_LABEL[status]}</span>;
}

export function PriorityBadge({ value }: { value: string | null }) {
  if (!value) return <span className="badge bg-red-50 text-red-600 ring-1 ring-red-200">Belum diisi</span>;
  return <span className={`badge ${PRIORITAS_CLS[value] ?? ""}`}>{value}</span>;
}
