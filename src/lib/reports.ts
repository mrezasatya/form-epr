// Perhitungan Laporan & Metrik (Spec Bagian 12) — fungsi murni, mudah diuji.
import type { ApprovalStatus, RequestStatus } from "@prisma/client";
import { businessDaysBetween, calendarDaysBetween, todayWib } from "./dates";
import { fulfillmentDateOf, placementDays, realisasi } from "./recruitment";

export type ReportPr = {
  id: string;
  prNo: string | null;
  jobTitle: string;
  divisiKode: string;
  jobLevel: string;
  kebutuhan: number;
  statusPersetujuan: ApprovalStatus;
  statusPermintaan: RequestStatus | null;
  tanggalPengajuan: Date | null;
  prReceivedDate: Date | null;
  expectedDate: Date;
  fulfillmentDate: Date | null;
  recruiterPic: string | null;
  currentLevel: number | null;
  candidates: { status: string; tanggalJoin: Date | null }[];
  approvals: { level: number; status: string; tanggal: Date | null; approverNama: string; approverPeran: string }[];
};

/** Sejak kapan approver saat ini menunggu: keputusan level sebelumnya terakhir, atau Tanggal Pengajuan. */
export function approvalWaitingSince(
  approvals: { level: number; tanggal: Date | null }[],
  currentLevel: number,
  tanggalPengajuan: Date,
): Date {
  const prev = approvals.filter((a) => a.level < currentLevel && a.tanggal).map((a) => todayWib(a.tanggal!).getTime());
  return prev.length ? new Date(Math.max(...prev, tanggalPengajuan.getTime())) : tanggalPengajuan;
}

export type Avg = { key: string; avg: number; n: number };

function groupAvg(items: { key: string; value: number }[]): Avg[] {
  const m = new Map<string, number[]>();
  for (const i of items) m.set(i.key, [...(m.get(i.key) ?? []), i.value]);
  return [...m.entries()]
    .map(([key, vs]) => ({ key, avg: vs.reduce((a, b) => a + b, 0) / vs.length, n: vs.length }))
    .sort((a, b) => b.avg - a.avg);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function computeReport(
  prs: ReportPr[],
  opts: { today: Date; holidays: Set<string>; pics: readonly string[]; reminderDays: number },
) {
  const { today, holidays } = opts;
  const submitted = prs.filter((p) => p.statusPersetujuan !== "DRAFT");
  const approved = submitted.filter((p) => p.statusPersetujuan === "DISETUJUI");

  const statusCounts = {
    MENUNGGU_APPROVAL: submitted.filter((p) => p.statusPersetujuan === "MENUNGGU_APPROVAL").length,
    OPEN: approved.filter((p) => p.statusPermintaan === "OPEN").length,
    ON_HOLD: approved.filter((p) => p.statusPermintaan === "ON_HOLD").length,
    FILLED: approved.filter((p) => p.statusPermintaan === "FILLED").length,
    CANCELLED: approved.filter((p) => p.statusPermintaan === "CANCELLED").length,
    DITOLAK: submitted.filter((p) => p.statusPersetujuan === "DITOLAK").length,
  };

  // Fulfillment rate = Σ Realisasi ÷ Σ Kebutuhan (PR yang sudah disetujui)
  const sumReal = approved.reduce((a, p) => a + realisasi(p.candidates), 0);
  const sumKeb = approved.reduce((a, p) => a + p.kebutuhan, 0);
  // Varian tanpa PR Cancelled (posisi yang dibatalkan tidak dianggap "gagal dipenuhi")
  const active = approved.filter((p) => p.statusPermintaan !== "CANCELLED");
  const sumRealX = active.reduce((a, p) => a + realisasi(p.candidates), 0);
  const sumKebX = active.reduce((a, p) => a + p.kebutuhan, 0);

  // Placement Time (hari kalender) untuk PR Filled
  const placements = approved
    .filter((p) => p.statusPermintaan === "FILLED")
    .map((p) => ({ p, d: placementDays(p.prReceivedDate, p.fulfillmentDate ?? fulfillmentDateOf(p.candidates)) }))
    .filter((x): x is { p: ReportPr; d: number } => x.d !== null);

  // Lama approval: Tanggal Pengajuan → PR Received Date
  const approvalDur = approved
    .filter((p) => p.tanggalPengajuan && p.prReceivedDate)
    .map((p) => ({
      cal: calendarDaysBetween(p.tanggalPengajuan!, p.prReceivedDate!),
      bus: businessDaysBetween(p.tanggalPengajuan!, p.prReceivedDate!, holidays),
    }));

  // PR melewati Expected Date dan belum Filled
  const late = approved
    .filter((p) => (p.statusPermintaan === "OPEN" || p.statusPermintaan === "ON_HOLD") && p.expectedDate < today)
    .map((p) => ({ pr: p, daysLate: calendarDaysBetween(p.expectedDate, today) }))
    .sort((a, b) => b.daysLate - a.daysLate);

  // Approval tertunda > N hari kerja (cikal bakal email pengingat — Spec 8)
  const pendingApprovals = submitted
    .filter((p) => p.statusPersetujuan === "MENUNGGU_APPROVAL" && p.currentLevel !== null)
    .map((p) => {
      const step = p.approvals.find((a) => a.level === p.currentLevel)!;
      const since = approvalWaitingSince(p.approvals, p.currentLevel!, p.tanggalPengajuan!);
      return { pr: p, step, since, waiting: businessDaysBetween(since, today, holidays) };
    })
    .filter((x) => x.step && x.waiting > opts.reminderDays)
    .sort((a, b) => b.waiting - a.waiting);

  // Beban kerja per Recruiter PIC
  const workload = [...opts.pics, null].map((pic) => {
    const mine = approved.filter((p) => p.recruiterPic === pic);
    const aktif = mine.filter((p) => p.statusPermintaan === "OPEN" || p.statusPermintaan === "ON_HOLD");
    return {
      pic: pic ?? "Belum ada PIC",
      open: aktif.filter((p) => p.statusPermintaan === "OPEN").length,
      onHold: aktif.filter((p) => p.statusPermintaan === "ON_HOLD").length,
      outstanding: aktif.reduce((a, p) => a + Math.max(0, p.kebutuhan - realisasi(p.candidates)), 0),
      filled: mine.filter((p) => p.statusPermintaan === "FILLED").length,
      late: late.filter((l) => l.pr.recruiterPic === pic).length,
    };
  }).filter((w) => w.pic !== "Belum ada PIC" || w.open + w.onHold + w.filled > 0);

  return {
    total: submitted.length,
    statusCounts,
    fulfillment: { realisasi: sumReal, kebutuhan: sumKeb, rate: sumKeb ? sumReal / sumKeb : null },
    fulfillmentExCancelled: { realisasi: sumRealX, kebutuhan: sumKebX, rate: sumKebX ? sumRealX / sumKebX : null },
    placement: {
      avg: mean(placements.map((x) => x.d)),
      n: placements.length,
      byDivisi: groupAvg(placements.map((x) => ({ key: x.p.divisiKode, value: x.d }))),
      byLevel: groupAvg(placements.map((x) => ({ key: x.p.jobLevel, value: x.d }))),
    },
    approvalDuration: { avgCalendar: mean(approvalDur.map((x) => x.cal)), avgBusiness: mean(approvalDur.map((x) => x.bus)), n: approvalDur.length },
    late,
    pendingApprovals,
    workload,
  };
}
