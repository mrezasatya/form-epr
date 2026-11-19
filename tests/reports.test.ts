import { describe, expect, it } from "vitest";
import { computeReport, type ReportPr } from "@/lib/reports";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const base: ReportPr = {
  id: "x", prNo: "001", jobTitle: "Welder", divisiKode: "PRO", jobLevel: "Operator", kebutuhan: 2,
  statusPersetujuan: "DISETUJUI", statusPermintaan: "OPEN", tanggalPengajuan: d("2026-11-02"),
  prReceivedDate: d("2026-11-04"), expectedDate: d("2027-01-05"), fulfillmentDate: null, recruiterPic: "Adnan",
  currentLevel: null, candidates: [], approvals: [],
};
const opts = { today: d("2026-11-20"), holidays: new Set<string>(), pics: ["Adnan", "Acha", "Ami"], reminderDays: 3 };

describe("computeReport", () => {
  const prs: ReportPr[] = [
    { ...base, id: "a", statusPermintaan: "FILLED", fulfillmentDate: d("2026-11-24"),
      candidates: [{ status: "Joined", tanggalJoin: d("2026-11-14") }, { status: "Joined", tanggalJoin: d("2026-11-24") }] },
    { ...base, id: "b", divisiKode: "ENG", kebutuhan: 3, expectedDate: d("2026-11-10"),
      candidates: [{ status: "Joined", tanggalJoin: d("2026-11-10") }] },
    { ...base, id: "c", statusPermintaan: "CANCELLED", kebutuhan: 1 },
    { ...base, id: "d", statusPersetujuan: "MENUNGGU_APPROVAL", statusPermintaan: null, prReceivedDate: null, currentLevel: 2,
      tanggalPengajuan: d("2026-11-09"),
      approvals: [
        { level: 1, status: "DISETUJUI", tanggal: d("2026-11-10"), approverNama: "Agus", approverPeran: "Kadiv" },
        { level: 2, status: "PENDING", tanggal: null, approverNama: "Siti", approverPeran: "Kepala HRD" },
      ] },
  ];
  const r = computeReport(prs, opts);

  it("menghitung status", () =>
    expect(r.statusCounts).toEqual({ MENUNGGU_APPROVAL: 1, OPEN: 1, ON_HOLD: 0, FILLED: 1, CANCELLED: 1, DITOLAK: 0 }));
  it("fulfillment rate = Σ realisasi ÷ Σ kebutuhan PR disetujui", () => {
    expect(r.fulfillment).toEqual({ realisasi: 3, kebutuhan: 6, rate: 0.5 });
    expect(r.fulfillmentExCancelled.rate).toBeCloseTo(3 / 5);
  });
  it("placement time rata-rata (hari kalender)", () => {
    expect(r.placement.avg).toBe(20); // 04/11 → 24/11
    expect(r.placement.byDivisi).toEqual([{ key: "PRO", avg: 20, n: 1 }]);
  });
  it("lama approval kalender & hari kerja", () => {
    expect(r.approvalDuration.avgCalendar).toBe(2);
    expect(r.approvalDuration.avgBusiness).toBe(2);
  });
  it("PR lewat Expected Date", () => expect(r.late.map((l) => [l.pr.id, l.daysLate])).toEqual([["b", 10]]));
  it("approval tertunda > 3 hari kerja dihitung sejak keputusan sebelumnya", () => {
    // 10/11 (Selasa) → 20/11 (Jumat) = 8 hari kerja
    expect(r.pendingApprovals.map((p) => [p.pr.id, p.waiting])).toEqual([["d", 8]]);
  });
  it("beban kerja PIC", () =>
    expect(r.workload[0]).toEqual({ pic: "Adnan", open: 1, onHold: 0, outstanding: 2, filled: 1, late: 1 }));
});
