import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canViewPr } from "@/lib/pr-service";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { tahapRingkas } from "@/lib/constants";
import { ApprovalBadge, RequestBadge } from "@/components/StatusBadge";
import { ApprovalTimeline } from "@/components/ApprovalTimeline";
import { DecisionPanel } from "@/components/DecisionPanel";

export const metadata = { title: "Detail PR" };

const AKSI: Record<string, string> = {
  SUBMIT: "Diajukan",
  APPROVE: "Disetujui",
  REJECT: "Ditolak",
  SKIP: "Dilewati otomatis",
  APPROVED: "Disetujui penuh",
};

export default async function PrDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ baru?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { baru } = await searchParams;
  const pr = await prisma.prRequest.findUnique({
    where: { id },
    include: {
      approvals: { orderBy: { level: "asc" } },
      replacedEmployees: true,
      statusHistory: { orderBy: { tanggal: "asc" } },
      candidates: true,
    },
  });
  if (!pr || !(await canViewPr(user, pr))) notFound();

  const current = pr.approvals.find((a) => a.level === pr.currentLevel);
  const myTurn = pr.statusPersetujuan === "MENUNGGU_APPROVAL" && current?.status === "PENDING" && current.approverNik === user.nik;
  const isOwner = pr.requesterNik === user.nik;

  const rows: [string, React.ReactNode][] = [
    ["Divisi / Departemen", `${pr.divisiKode} / ${pr.departemenKode}`],
    ["Job Level", pr.jobLevel],
    ["Lokasi Kerja", pr.lokasiKerja],
    ["Job Responsibilities", <span key="jr" className="whitespace-pre-line">{pr.jobResponsibilities}</span>],
    ["Level Pendidikan", pr.levelPendidikan],
    ["Jurusan", pr.jurusan.join(", ")],
    ["Pengalaman", pr.pengalaman],
    ["Hard Skill", pr.hardSkills.join(", ")],
    ["Soft Skill", pr.softSkills.join(", ")],
    ["Sertifikasi Wajib", pr.sertifikasiWajib ? pr.sertifikasi.join(", ") : "Tidak"],
    ["Status of Employment", pr.statusEmployment],
    ["Duration of Contract", pr.durationContract === "Others" ? `Others: ${pr.durationOthers}` : pr.durationContract],
    ["Kebutuhan", `${pr.kebutuhan} orang`],
    ["Jenis Kebutuhan", pr.jenisKebutuhan],
    ...(pr.jenisKebutuhan === "Replacement"
      ? ([["Menggantikan", pr.replacedEmployees.map((r) => (r.nik ? `${r.nama} (${r.nik})` : r.nama)).join(", ")]] as [string, string][])
      : []),
    ["Hiring Manager", pr.requesterNama],
    ["Tanggal Pengajuan", fmtDate(pr.tanggalPengajuan)],
    ["Expected Date", fmtDate(pr.expectedDate)],
    ["Catatan (Remarks)", pr.remarks ?? "—"],
  ];

  return (
    <div className="space-y-5">
      {baru && pr.prNo && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          PR berhasil diajukan dengan nomor <b>{pr.prNo}</b>
          {pr.statusPersetujuan === "MENUNGGU_APPROVAL" && current ? <> dan dikirim ke {current.approverNama} ({current.approverPeran}).</> : "."}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{pr.prNo ?? "Draft (belum ada PR NO)"}</div>
          <h1 className="page-title">{pr.jobTitle || "(tanpa judul)"}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <ApprovalBadge status={pr.statusPersetujuan} level={pr.currentLevel} approverPeran={current?.approverPeran} />
            {pr.statusPermintaan && <RequestBadge status={pr.statusPermintaan} />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner && pr.statusPersetujuan === "DRAFT" && (
            <Link href={`/pr/baru?draft=${pr.id}`} className="btn btn-primary">
              Lanjutkan Draft
            </Link>
          )}
          {user.canRequest && pr.statusPersetujuan !== "DRAFT" && (
            <Link href={`/pr/baru?dari=${pr.id}`} className="btn btn-secondary">
              Duplikat PR
            </Link>
          )}
        </div>
      </div>

      {myTurn && current && <DecisionPanel prId={pr.id} level={current.level} />}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-2 font-semibold">Isian e-PR</h2>
          <dl className="divide-y divide-slate-100 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-3">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium break-words sm:col-span-2">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="space-y-5">
          <section className="card">
            <h2 className="mb-3 font-semibold">Timeline Approval</h2>
            <ApprovalTimeline steps={pr.approvals} />
          </section>

          {pr.statusPersetujuan === "DISETUJUI" && (
            <section className="card text-sm">
              <h2 className="mb-2 font-semibold">Progres Rekrutmen</h2>
              <dl className="space-y-1.5">
                <div className="flex justify-between gap-2"><dt className="text-slate-500">PR Received</dt><dd>{fmtDate(pr.prReceivedDate)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Target Start</dt><dd>{fmtDate(pr.targetStartDate)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Tahap</dt><dd>{tahapRingkas(pr.tahapDetail)}</dd></div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Kebutuhan / Realisasi</dt>
                  <dd>{pr.kebutuhan} / {pr.candidates.filter((c) => c.status === "Joined").length}</dd>
                </div>
              </dl>
              <p className="hint mt-3">Pengelolaan oleh rekruter tersedia di Fase 2.</p>
            </section>
          )}

          <section className="card">
            <h2 className="mb-3 font-semibold">Riwayat Aksi</h2>
            <ul className="space-y-2 text-sm">
              {pr.statusHistory.length === 0 && <li className="text-slate-500">Belum ada.</li>}
              {pr.statusHistory.map((h) => (
                <li key={h.id} className="border-b border-slate-100 pb-2 last:border-0">
                  <div className="font-medium">
                    {AKSI[h.aksi] ?? h.aksi}
                    {h.ke ? ` → ${h.ke}` : ""}
                  </div>
                  <div className="text-xs text-slate-500">
                    {fmtDateTime(h.tanggal)} · {h.olehNama ?? "—"}
                  </div>
                  {h.alasan && <div className="text-slate-600">{h.alasan}</div>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
