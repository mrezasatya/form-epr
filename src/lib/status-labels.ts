import type { ApprovalStatus, RequestStatus } from "@prisma/client";

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  OPEN: "Open",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
  FILLED: "Filled",
};

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  DRAFT: "Draft",
  MENUNGGU_APPROVAL: "Menunggu Approval",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
};

export const requestStatusLabel = (s: RequestStatus | null | undefined) => (s ? REQUEST_STATUS_LABEL[s] : "—");

/** Label Status Persetujuan, mis. "Menunggu Approval 2 – Kepala HRD" (Spec 7.2). */
export function approvalStatusText(s: ApprovalStatus, level?: number | null, peran?: string | null) {
  if (s === "MENUNGGU_APPROVAL" && level) return `Menunggu Approval ${level}${peran ? ` – ${peran}` : ""}`;
  return APPROVAL_STATUS_LABEL[s];
}
