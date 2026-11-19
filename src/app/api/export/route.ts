import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth/session";
import { findRecruiterPrs, parseFilters } from "@/lib/recruiter-query";
import { fmtDate, todayWib, toIsoDate } from "@/lib/dates";
import { tahapRingkas } from "@/lib/constants";
import { fulfillmentDateOf, placementDays, realisasi } from "@/lib/recruitment";
import { approvalStatusText, requestStatusLabel } from "@/lib/status-labels";

export const dynamic = "force-dynamic";

/** Export Excel semua kolom Dashboard Rekruter, mengikuti filter aktif (Spec 10.4). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !(user.isRecruiter || user.isAdminHr)) return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const prs = await findRecruiterPrs(parseFilters(sp));

  const wb = new ExcelJS.Workbook();
  wb.creator = "e-PR";
  const ws = wb.addWorksheet("Data PR", { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  const cols: [string, number][] = [
    ["PR NO", 22], ["Job Title", 28], ["Divisi", 10], ["Departemen", 14], ["Job Level", 16],
    ["Job Responsibilities", 50], ["Lokasi Kerja", 14], ["Pendidikan", 12], ["Jurusan", 30], ["Pengalaman", 22],
    ["Hard Skill", 30], ["Soft Skill", 30], ["Sertifikasi", 30], ["Status of Employment", 18],
    ["Duration of Contract", 22], ["Kebutuhan", 10], ["Realisasi", 10], ["Jenis Kebutuhan", 15],
    ["Nama yang Digantikan", 28], ["Prioritas", 10], ["Tanggal Pengajuan", 14], ["PR Received Date", 14],
    ["Expected Date", 14], ["Target Start Date", 14],
    ["Approval 1 Name", 20], ["Approval 1 Date", 14], ["Approval 2 Name", 20], ["Approval 2 Date", 14],
    ["Approval 3 Name", 20], ["Approval 3 Date", 14], ["Status Persetujuan", 30], ["Status Permintaan", 14],
    ["Tahap Saat Ini", 16], ["Tahap (ringkas)", 12], ["Kandidat", 40], ["Fulfillment Date", 14],
    ["Placement Time (Days)", 12], ["Hiring Manager", 20], ["Recruiter PIC", 12], ["Alasan Hold", 30],
    ["Estimasi Selesai Hold", 14], ["Progress Note", 40], ["Note", 40], ["Remarks Pemohon", 30],
  ];
  ws.columns = cols.map(([header, width]) => ({ header, width }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D5FBF" } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  for (const pr of prs) {
    const ap = (lvl: number) => pr.approvals.find((a) => a.level === lvl && (a.status === "DISETUJUI" || a.status === "DILEWATI"));
    const current = pr.approvals.find((a) => a.level === pr.currentLevel);
    const ff = pr.fulfillmentDate ?? fulfillmentDateOf(pr.candidates);
    ws.addRow([
      pr.prNo, pr.jobTitle, pr.divisiKode, pr.departemenKode, pr.jobLevel, pr.jobResponsibilities, pr.lokasiKerja,
      pr.levelPendidikan, pr.jurusan.join(", "), pr.pengalaman, pr.hardSkills.join(", "), pr.softSkills.join(", "),
      pr.sertifikasiWajib ? pr.sertifikasi.join(", ") : "Tidak",
      pr.statusEmployment, pr.durationContract === "Others" ? `Others: ${pr.durationOthers}` : pr.durationContract,
      pr.kebutuhan, realisasi(pr.candidates), pr.jenisKebutuhan, pr.replacedEmployees.map((r) => r.nama).join(", "),
      pr.prioritas ?? "", fmtDate(pr.tanggalPengajuan), fmtDate(pr.prReceivedDate), fmtDate(pr.expectedDate),
      fmtDate(pr.targetStartDate),
      ap(1)?.approverNama ?? "", ap(1) ? fmtDate(ap(1)!.tanggal) : "",
      ap(2)?.approverNama ?? "", ap(2) ? fmtDate(ap(2)!.tanggal) : "",
      ap(3)?.approverNama ?? "", ap(3) ? fmtDate(ap(3)!.tanggal) : "",
      approvalStatusText(pr.statusPersetujuan, pr.currentLevel, current?.approverPeran),
      requestStatusLabel(pr.statusPermintaan), pr.tahapDetail ?? "",
      pr.statusPersetujuan === "DISETUJUI" ? tahapRingkas(pr.tahapDetail) : "",
      pr.candidates.map((c) => `${c.nama} (${c.sumber}, ${c.status}${c.tanggalJoin ? `, ${fmtDate(c.tanggalJoin)}` : ""})`).join("; "),
      pr.statusPermintaan === "FILLED" ? fmtDate(ff) : "",
      pr.statusPermintaan === "FILLED" ? (placementDays(pr.prReceivedDate, ff) ?? "") : "",
      pr.requesterNama, pr.recruiterPic ?? "", pr.alasanHold ?? "", fmtDate(pr.estimasiSelesaiHold).replace("—", ""),
      pr.progressNote ?? "", pr.note ?? "", pr.remarks ?? "",
    ].map((v) => (v === "—" ? "" : v)));
  }
  ws.eachRow((row, i) => {
    if (i > 1) row.alignment = { vertical: "top", wrapText: true };
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ePR_${toIsoDate(todayWib())}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
