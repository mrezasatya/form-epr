import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { filtersToQuery, findRecruiterPrs, parseFilters, recruiterWhere } from "@/lib/recruiter-query";
import { fmtDate, todayWib } from "@/lib/dates";
import { PRIORITAS, RECRUITER_PIC } from "@/lib/constants";
import { fulfillmentDateOf, placementDays, realisasi } from "@/lib/recruitment";
import { ApprovalBadge, PriorityBadge, RequestBadge } from "@/components/StatusBadge";

export const metadata = { title: "Dashboard Rekruter" };

const STATUS_OPTIONS: [string, string][] = [
  ["", "Semua status"],
  ["MENUNGGU_APPROVAL", "Menunggu Approval"],
  ["OPEN", "Open"],
  ["ON_HOLD", "On Hold"],
  ["FILLED", "Filled"],
  ["CANCELLED", "Cancelled"],
  ["DITOLAK", "Ditolak"],
  ["PERLU_DILENGKAPI", "⚠ Prioritas/PIC belum diisi"],
  ["PENGAJUAN", "⚠ Ada pengajuan pemohon"],
  ["TERLAMBAT", "⚠ Lewat Expected Date"],
];

export default async function RecruiterDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!user.isRecruiter && !user.isAdminHr) redirect("/pr");
  const f = parseFilters(await searchParams);
  const today = todayWib();

  const [prs, divisions, counts] = await Promise.all([
    findRecruiterPrs(f, 500),
    prisma.division.findMany({ orderBy: { kode: "asc" }, select: { kode: true } }),
    Promise.all(
      (["OPEN", "ON_HOLD", "PERLU_DILENGKAPI", "PENGAJUAN", "TERLAMBAT", "MENUNGGU_APPROVAL"] as const).map(async (s) => [
        s,
        await prisma.prRequest.count({ where: recruiterWhere({ status: s }) }),
      ]),
    ),
  ]);
  const count = Object.fromEntries(counts) as Record<string, number>;
  const qs = filtersToQuery(f);

  const tiles: [string, string, string][] = [
    ["OPEN", "Open", "text-blue-700"],
    ["ON_HOLD", "On Hold", "text-orange-700"],
    ["MENUNGGU_APPROVAL", "Menunggu Approval", "text-amber-700"],
    ["PERLU_DILENGKAPI", "Prioritas/PIC kosong", "text-red-700"],
    ["PENGAJUAN", "Pengajuan pemohon", "text-red-700"],
    ["TERLAMBAT", "Lewat Expected Date", "text-red-700"],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard Rekruter</h1>
          <p className="text-sm text-slate-500">{prs.length} PR sesuai filter</p>
        </div>
        <a href={`/api/export${qs ? `?${qs}` : ""}`} className="btn btn-secondary">
          ⬇ Export Excel
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([key, label, cls]) => (
          <Link key={key} href={`/rekrutmen?status=${key}`} className={`card p-3 hover:border-brand-600 ${f.status === key ? "border-brand-600 ring-2 ring-brand-100" : ""}`}>
            <div className="text-xs text-slate-500">{label}</div>
            <div className={`text-2xl font-bold ${count[key] ? cls : "text-slate-400"}`}>{count[key]}</div>
          </Link>
        ))}
      </div>

      <form className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-7" method="get">
        <input name="q" defaultValue={f.q} placeholder="Cari PR NO, job title, pemohon" className="input lg:col-span-2" />
        <select name="divisi" defaultValue={f.divisi ?? ""} className="input">
          <option value="">Semua divisi</option>
          {divisions.map((d) => <option key={d.kode}>{d.kode}</option>)}
        </select>
        <select name="status" defaultValue={f.status ?? ""} className="input">
          {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="prioritas" defaultValue={f.prioritas ?? ""} className="input">
          <option value="">Semua prioritas</option>
          {PRIORITAS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select name="pic" defaultValue={f.pic ?? ""} className="input">
          <option value="">Semua PIC</option>
          {RECRUITER_PIC.map((p) => <option key={p}>{p}</option>)}
          <option value="-">Belum ada PIC</option>
        </select>
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1">Terapkan</button>
          {qs && <Link href="/rekrutmen" className="btn btn-secondary">Reset</Link>}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 lg:col-span-3">
          Tgl pengajuan
          <input type="date" name="dari" defaultValue={f.dari} className="input" />
          s/d
          <input type="date" name="sampai" defaultValue={f.sampai} className="input" />
        </label>
      </form>

      {prs.length === 0 ? (
        <div className="card text-center text-slate-500">Tidak ada PR sesuai filter.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-3">PR NO</th>
                <th className="px-3 py-3">Job Title</th>
                <th className="px-3 py-3">Divisi / Dept</th>
                <th className="px-3 py-3">Prioritas</th>
                <th className="px-3 py-3">PIC</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Tahap</th>
                <th className="px-3 py-3 text-center">Real./Keb.</th>
                <th className="px-3 py-3">Tgl Pengajuan</th>
                <th className="px-3 py-3">PR Received</th>
                <th className="px-3 py-3">Expected</th>
                <th className="px-3 py-3">Target Start</th>
                <th className="px-3 py-3 text-center">Placement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prs.map((pr) => {
                const current = pr.approvals.find((a) => a.level === pr.currentLevel);
                const real = realisasi(pr.candidates);
                const late = (pr.statusPermintaan === "OPEN" || pr.statusPermintaan === "ON_HOLD") && pr.expectedDate < today;
                const ff = pr.fulfillmentDate ?? fulfillmentDateOf(pr.candidates);
                const approved = pr.statusPersetujuan === "DISETUJUI";
                return (
                  <tr key={pr.id} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-3 whitespace-nowrap">{pr.prNo}</td>
                    <td className="px-3 py-3">
                      <Link href={`/pr/${pr.id}`} className="font-medium text-brand-700 hover:underline">{pr.jobTitle}</Link>
                      <div className="text-xs text-slate-500">{pr.jobLevel} · {pr.requesterNama}</div>
                      {pr.actionRequests.map((r) => (
                        <span key={r.id} className="badge mt-1 bg-red-100 text-red-700">Pengajuan {r.jenis}</span>
                      ))}
                    </td>
                    <td className="px-3 py-3">{pr.divisiKode}<div className="text-xs text-slate-500">{pr.departemenKode}</div></td>
                    <td className="px-3 py-3">{approved ? <PriorityBadge value={pr.prioritas} /> : "—"}</td>
                    <td className="px-3 py-3">{pr.recruiterPic ?? (approved ? <span className="text-red-600">—</span> : "—")}</td>
                    <td className="px-3 py-3">
                      {approved ? <RequestBadge status={pr.statusPermintaan} /> : <ApprovalBadge status={pr.statusPersetujuan} level={pr.currentLevel} approverPeran={current?.approverPeran} />}
                    </td>
                    <td className="px-3 py-3">{pr.tahapDetail ?? (approved ? "Menunggu" : "—")}</td>
                    <td className={`px-3 py-3 text-center ${approved && real >= pr.kebutuhan ? "font-semibold text-emerald-700" : ""}`}>{real}/{pr.kebutuhan}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(pr.tanggalPengajuan)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(pr.prReceivedDate)}</td>
                    <td className={`px-3 py-3 whitespace-nowrap ${late ? "font-semibold text-red-600" : ""}`}>{fmtDate(pr.expectedDate)}{late && " ⚠"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(pr.targetStartDate)}</td>
                    <td className="px-3 py-3 text-center">{pr.statusPermintaan === "FILLED" ? `${placementDays(pr.prReceivedDate, ff)} hari` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
