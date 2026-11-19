import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canViewPr } from "@/lib/pr-service";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { approvalStatusText, requestStatusLabel } from "@/lib/status-labels";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Cetak PR" };

/**
 * Cetak PR (Spec 7.4): data lengkap + kolom tanda tangan sesuai matriks approval.
 * PDF dibuat dengan fitur "Simpan sebagai PDF" browser — tidak butuh layanan/komponen tambahan di server.
 */
export default async function PrintPrPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const pr = await prisma.prRequest.findUnique({
    where: { id },
    include: { approvals: { orderBy: { level: "asc" } }, replacedEmployees: true },
  });
  if (!pr || !pr.prNo || !(await canViewPr(user, pr))) notFound();
  const current = pr.approvals.find((a) => a.level === pr.currentLevel);

  const rows: [string, string][] = [
    ["Divisi / Departemen", `${pr.divisiKode} / ${pr.departemenKode}`],
    ["Job Title", pr.jobTitle],
    ["Job Level", pr.jobLevel],
    ["Job Responsibilities", pr.jobResponsibilities],
    ["Lokasi Kerja", pr.lokasiKerja],
    ["Level Pendidikan / Jurusan", `${pr.levelPendidikan} — ${pr.jurusan.join(", ")}`],
    ["Pengalaman", pr.pengalaman],
    ["Hard Skill", pr.hardSkills.join(", ")],
    ["Soft Skill", pr.softSkills.join(", ")],
    ["Sertifikasi Wajib", pr.sertifikasiWajib ? pr.sertifikasi.join(", ") : "Tidak"],
    ["Status of Employment", pr.statusEmployment],
    ["Duration of Contract", pr.durationContract === "Others" ? `Others: ${pr.durationOthers}` : pr.durationContract],
    ["Kebutuhan / Jenis", `${pr.kebutuhan} orang — ${pr.jenisKebutuhan}`],
    ...(pr.jenisKebutuhan === "Replacement"
      ? ([["Menggantikan", pr.replacedEmployees.map((r) => (r.nik ? `${r.nama} (${r.nik})` : r.nama)).join(", ")]] as [string, string][])
      : []),
    ["Hiring Manager", pr.requesterNama],
    ["Tanggal Pengajuan", fmtDate(pr.tanggalPengajuan)],
    ["Expected Date", fmtDate(pr.expectedDate)],
    ["Catatan (Remarks)", pr.remarks ?? "—"],
  ];

  const signers = [
    { judul: "Diajukan oleh", peran: "Hiring Manager", nama: pr.requesterNama, info: fmtDate(pr.tanggalPengajuan) },
    ...pr.approvals.map((a) => ({
      judul: `Approval ${a.level}`,
      peran: a.approverPeran,
      nama: a.approverNama,
      info:
        a.status === "DISETUJUI"
          ? `Disetujui ${fmtDate(a.tanggal)}${a.sumber === "KERTAS" ? " (kertas)" : " (sistem)"}`
          : a.status === "DILEWATI"
            ? "Dilewati (pemohon)"
            : a.status === "DITOLAK"
              ? `Ditolak ${fmtDate(a.tanggal)}`
              : "",
    })),
  ];

  return (
    <div className="print-page mx-auto max-w-[210mm] bg-white p-6 text-[13px] text-black sm:my-6 sm:shadow">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
        }
      `}</style>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-100 p-3 text-sm">
        <span>Pratinjau cetak. Pilih printer atau &quot;Simpan sebagai PDF&quot;.</span>
        <PrintButton />
      </div>

      <header className="mb-4 flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <div className="text-lg font-bold">FORMULIR PERMINTAAN TENAGA KERJA</div>
          <div>Personnel Request (e-PR)</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-base font-bold">{pr.prNo}</div>
          <div>{approvalStatusText(pr.statusPersetujuan, pr.currentLevel, current?.approverPeran)}</div>
          {pr.statusPermintaan && <div>Status Permintaan: {requestStatusLabel(pr.statusPermintaan)}</div>}
        </div>
      </header>

      <table className="w-full border-collapse">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="align-top">
              <td className="w-[32%] border border-slate-400 bg-slate-50 px-2 py-1 font-medium">{k}</td>
              <td className="border border-slate-400 px-2 py-1 whitespace-pre-line">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-5 mb-2 font-bold">Persetujuan</h2>
      <table className="w-full table-fixed border-collapse text-center" style={{ breakInside: "avoid" }}>
        <thead>
          <tr>
            {signers.map((s) => (
              <th key={s.judul} className="border border-slate-400 bg-slate-50 px-1 py-1 font-medium">
                {s.judul}
                <div className="text-[11px] font-normal">{s.peran}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {signers.map((s) => (
              <td key={s.judul} className="h-24 border border-slate-400 align-bottom text-[11px] text-slate-600">{s.info}</td>
            ))}
          </tr>
          <tr>
            {signers.map((s) => (
              <td key={s.judul} className="border border-slate-400 px-1 py-1 font-medium">{s.nama}</td>
            ))}
          </tr>
          <tr>
            {signers.map((s) => (
              <td key={s.judul} className="border border-slate-400 px-1 py-1 text-left text-[11px]">Tgl:</td>
            ))}
          </tr>
        </tbody>
      </table>

      <footer className="mt-4 flex justify-between text-[10px] text-slate-500">
        <span>Dicetak dari e-PR oleh {user.nama}</span>
        <span>{fmtDateTime(new Date())} WIB</span>
      </footer>
    </div>
  );
}
