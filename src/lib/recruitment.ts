// Aturan murni proses rekrutmen (Spec 10.2, 10.3, 9) — tanpa akses DB agar mudah diuji.
import type { RequestStatus } from "@prisma/client";
import { calendarDaysBetween } from "./dates";

type Cand = { status: string; tanggalJoin: Date | null };

/** Realisasi = jumlah kandidat berstatus Joined. */
export function realisasi(cands: Cand[]): number {
  return cands.filter((c) => c.status === "Joined").length;
}

/** Fulfillment Date = tanggal join kandidat Joined terakhir. */
export function fulfillmentDateOf(cands: Cand[]): Date | null {
  const dates = cands.filter((c) => c.status === "Joined" && c.tanggalJoin).map((c) => c.tanggalJoin!.getTime());
  return dates.length ? new Date(Math.max(...dates)) : null;
}

/** Placement Time (hari kalender) = Fulfillment Date − PR Received Date. */
export function placementDays(prReceived: Date | null, fulfillment: Date | null): number | null {
  return prReceived && fulfillment ? calendarDaysBetween(prReceived, fulfillment) : null;
}

export type StatusAction = "HOLD" | "UNHOLD" | "CANCEL" | "FILLED";

/** Transisi status yang diizinkan (Spec 7.2): Open ⇄ On Hold → Filled | Cancelled. */
export function allowedActions(status: RequestStatus | null): StatusAction[] {
  switch (status) {
    case "OPEN":
      return ["HOLD", "CANCEL", "FILLED"];
    case "ON_HOLD":
      return ["UNHOLD", "CANCEL"];
    default:
      return [];
  }
}

export const ACTION_LABEL: Record<StatusAction, string> = {
  HOLD: "On Hold",
  UNHOLD: "Unhold (Open kembali)",
  CANCEL: "Cancel",
  FILLED: "Filled",
};

export const ACTION_TARGET: Record<StatusAction, RequestStatus> = {
  HOLD: "ON_HOLD",
  UNHOLD: "OPEN",
  CANCEL: "CANCELLED",
  FILLED: "FILLED",
};

/** Validasi data kandidat. Mengembalikan pesan error atau null. */
export function validateCandidate(
  c: { nama: string; sumber: string; status: string; tanggalJoin: Date | null },
  ctx: { prReceivedDate: Date | null; kebutuhan: number; joinedOthers: number },
): string | null {
  if (!c.nama.trim()) return "Nama kandidat wajib diisi.";
  if (!c.sumber) return "Sumber kandidat wajib dipilih.";
  if (!c.status) return "Status kandidat wajib dipilih.";
  if (c.status === "Joined") {
    if (!c.tanggalJoin) return "Tanggal Join wajib diisi untuk kandidat Joined.";
    if (ctx.joinedOthers + 1 > ctx.kebutuhan) return "Jumlah kandidat Joined melebihi Kebutuhan.";
  }
  if (c.tanggalJoin && ctx.prReceivedDate && c.tanggalJoin < ctx.prReceivedDate)
    return "Tanggal Join tidak boleh sebelum PR Received Date.";
  return null;
}
