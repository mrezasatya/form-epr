import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canViewPr } from "@/lib/pr-service";
import { canRequestAction } from "@/lib/recruitment-service";
import { fmtDate, fmtDateTime, todayWib, toIsoDate } from "@/lib/dates";
import { tahapRingkas } from "@/lib/constants";
import { fulfillmentDateOf, placementDays, realisasi, type StatusAction } from "@/lib/recruitment";
import { ApprovalBadge, PriorityBadge, RequestBadge } from "@/components/StatusBadge";
import { ApprovalTimeline } from "@/components/ApprovalTimeline";
import { DecisionPanel } from "@/components/DecisionPanel";
import { ProcessForm } from "@/components/recruitment/ProcessForm";
import { CandidatesPanel } from "@/components/recruitment/CandidatesPanel";
import { StatusActions } from "@/components/recruitment/StatusActions";
import { RequestActionPanel } from "@/components/recruitment/RequestActionPanel";

export const metadata = { title: "Detail PR" };

const AKSI: Record<string, string> = {
  SUBMIT: "Diajukan",
  APPROVE: "Disetujui",
  REJECT: "Ditolak",
  SKIP: "Dilewati otomatis",
  APPROVED: "Disetujui penuh",
  HOLD: "Status permintaan",
  UNHOLD: "Status permintaan (Unhold)",
  CANCEL: "Status permintaan",
  FILLED: "Status permintaan",
  PENGAJUAN: "Pengajuan pemohon",
  PENGAJUAN_DITOLAK: "Pengajuan tidak diproses",
  UPDATE: "Perubahan data",
  KANDIDAT: "Kandidat",
};
/** Riwayat yang ditampilkan ke pemohon/Kadiv (Spec 11: riwayat hold/unhold/cancel + memo). */
const USER_VISIBLE = new Set(["SUBMIT", "APPROVE", "REJECT", "SKIP", "APPROVED", "HOLD", "UNHOLD", "CANCEL", "FILLED", "PENGAJUAN", "PENGAJUAN_DITOLAK"]);

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
      candidates: { orderBy: { createdAt: "asc" } },
      actionRequests: { where: { status: "MENUNGGU" }, orderBy: { tanggal: "desc" }, take: 1 },
    },
  });
  if (!pr || !(await canViewPr(user, pr))) notFound();

  const current = pr.approvals.find((a) => a.level === pr.currentLevel);
  const myTurn = pr.statusPersetujuan === "MENUNGGU_APPROVAL" && current?.status === "PENDING" && current.approverNik === user.nik;
  const isOwner = pr.requesterNik === user.nik;
  const approved = pr.statusPersetujuan === "DISETUJUI";
  const recruiter = user.isRecruiter;
  const closed = pr.statusPermintaan === "FILLED" || pr.statusPermintaan === "CANCELLED";
  const real = realisasi(pr.candidates);
  const joined = pr.candidates.filter((c) => c.status === "Joined");
  const ff = pr.fulfillmentDate ?? fulfillmentDateOf(pr.candidates);
  const todayIso = toIsoDate(todayWib());
  const pendingReq = pr.actionRequests[0] ?? null;
  const history = recruiter || user.isAdminHr ? pr.statusHistory : pr.statusHistory.filter((h) => USER_VISIBLE.has(h.aksi));

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

  const progress: [string, React.ReactNode][] = [
    ["Status Permintaan", <RequestBadge key="s" status={pr.statusPermintaan} />],
    ["Tahap Saat Ini", recruiter ? `${pr.tahapDetail ?? "Menunggu"} (${tahapRingkas(pr.tahapDetail)})` : tahapRingkas(pr.tahapDetail)],
    ["Realisasi / Kebutuhan", `${real} / ${pr.kebutuhan}`],
    ["PR Received Date", fmtDate(pr.prReceivedDate)],
    ["Target Start Date", fmtDate(pr.targetStartDate)],
    ["Expected Date", fmtDate(pr.expectedDate)],
    ...(pr.statusPermintaan === "ON_HOLD"
      ? ([
          ["Alasan Hold", pr.alasanHold],
          ["Estimasi Selesai Hold", fmtDate(pr.estimasiSelesaiHold)],
        ] as [string, React.ReactNode][])
      : []),
    ...(pr.statusPermintaan === "FILLED"
      ? ([
          ["Fulfillment Date", fmtDate(ff)],
          ["Placement Time", `${placementDays(pr.prReceivedDate, ff)} hari`],
        ] as [string, React.ReactNode][])
      : []),
    ...(recruiter ? ([["Recruiter PIC", pr.recruiterPic ?? "—"]] as [string, React.ReactNode][]) : []),
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
            {recruiter && approved && <PriorityBadge value={pr.prioritas} />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(recruiter || user.isAdminHr) && (
            <Link href="/rekrutmen" className="btn btn-secondary">← Dashboard</Link>
          )}
          {isOwner && pr.statusPersetujuan === "DRAFT" && (
            <Link href={`/pr/baru?draft=${pr.id}`} className="btn btn-primary">Lanjutkan Draft</Link>
          )}
          {user.canRequest && pr.statusPersetujuan !== "DRAFT" && (
            <Link href={`/pr/baru?dari=${pr.id}`} className="btn btn-secondary">Duplikat PR</Link>
          )}
        </div>
      </div>

      {myTurn && current && <DecisionPanel prId={pr.id} level={current.level} />}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {recruiter && approved && (
            <>
              <StatusActions
                prId={pr.id}
                status={pr.statusPermintaan}
                realisasi={real}
                kebutuhan={pr.kebutuhan}
                todayIso={todayIso}
                assigned={!!(pr.prioritas && pr.recruiterPic)}
                pendingRequest={
                  pendingReq && {
                    id: pendingReq.id,
                    jenis: pendingReq.jenis as StatusAction,
                    alasan: pendingReq.alasan,
                    estimasiSelesai: pendingReq.estimasiSelesai ? toIsoDate(pendingReq.estimasiSelesai) : null,
                    fileMemo: pendingReq.fileMemo,
                    olehNama: pendingReq.olehNama,
                    tanggal: pendingReq.tanggal.toISOString(),
                  }
                }
              />
              <ProcessForm
                key={pr.statusPermintaan ?? ""}
                prId={pr.id}
                closed={closed}
                initial={{
                  prioritas: pr.prioritas ?? "",
                  recruiterPic: pr.recruiterPic ?? "",
                  tahapDetail: pr.tahapDetail ?? "",
                  targetStartDate: pr.targetStartDate ? toIsoDate(pr.targetStartDate) : "",
                  progressNote: pr.progressNote ?? "",
                  note: pr.note ?? "",
                }}
              />
              <CandidatesPanel
                prId={pr.id}
                kebutuhan={pr.kebutuhan}
                editable={!closed}
                minJoin={pr.prReceivedDate ? toIsoDate(pr.prReceivedDate) : null}
                candidates={pr.candidates.map((c) => ({
                  id: c.id,
                  nama: c.nama,
                  sumber: c.sumber,
                  status: c.status,
                  tanggalJoin: c.tanggalJoin ? toIsoDate(c.tanggalJoin) : null,
                }))}
              />
            </>
          )}

          <section className="card">
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
        </div>

        <div className="space-y-5">
          {approved && (
            <section className="card text-sm">
              <h2 className="mb-2 font-semibold">Progres Rekrutmen</h2>
              <dl className="space-y-1.5">
                {progress.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              {joined.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-slate-500">Kandidat Final (Joined)</div>
                  <ul className="space-y-1">
                    {joined.map((c) => (
                      <li key={c.id} className="flex justify-between gap-2 rounded bg-emerald-50 px-2 py-1">
                        <span className="font-medium">{c.nama}</span>
                        <span className="text-emerald-800">{fmtDate(c.tanggalJoin)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {pr.progressNote && (
                <div className="mt-3">
                  <div className="mb-1 text-slate-500">Progress Note dari rekruter</div>
                  <p className="rounded bg-slate-50 p-2 whitespace-pre-line">{pr.progressNote}</p>
                </div>
              )}
            </section>
          )}

          {approved && !recruiter && canRequestAction(user, pr) && (
            <RequestActionPanel
              prId={pr.id}
              status={pr.statusPermintaan}
              todayIso={todayIso}
              pending={pendingReq && { jenis: pendingReq.jenis, tanggal: pendingReq.tanggal.toISOString() }}
            />
          )}

          <section className="card" id="timeline">
            <h2 className="mb-3 font-semibold">Timeline Approval</h2>
            <ApprovalTimeline steps={pr.approvals} />
          </section>

          <section className="card" id="riwayat">
            <h2 className="mb-3 font-semibold">Riwayat Aksi</h2>
            <ul className="space-y-2 text-sm">
              {history.length === 0 && <li className="text-slate-500">Belum ada.</li>}
              {history.map((h) => (
                <li key={h.id} className="border-b border-slate-100 pb-2 last:border-0">
                  <div className="font-medium">
                    {AKSI[h.aksi] ?? h.aksi}
                    {h.aksi === "UPDATE" || h.aksi === "KANDIDAT" ? `: ${h.alasan}` : ""}
                    {h.dari && h.ke && (h.aksi === "UPDATE" || h.aksi === "KANDIDAT") ? ` (${h.dari} → ${h.ke})` : h.ke && h.aksi !== "UPDATE" && h.aksi !== "KANDIDAT" ? ` → ${h.ke}` : ""}
                  </div>
                  <div className="text-xs text-slate-500">
                    {fmtDateTime(h.tanggal)} · {h.olehNama ?? "—"}
                  </div>
                  {h.alasan && h.aksi !== "UPDATE" && h.aksi !== "KANDIDAT" && <div className="text-slate-600">{h.alasan}</div>}
                  {h.fileMemo && (
                    <a href={`/api/files/${h.fileMemo}`} target="_blank" className="text-brand-700 underline">
                      📎 Lihat memo
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
