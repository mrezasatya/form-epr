import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { holidaySet } from "@/lib/pr-service";
import { computeReport } from "@/lib/reports";
import { fmtDate, parseIsoDate, todayWib, toIsoDate } from "@/lib/dates";
import { RECRUITER_PIC } from "@/lib/constants";
import { HBarChart } from "@/components/HBarChart";

export const metadata = { title: "Laporan & Metrik" };

const REMINDER_DAYS = 3; // [KONFIRMASI] Spec 14 #8

const pct = (r: number | null) => (r === null ? "—" : `${(r * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`);
const num = (v: number | null, d = 1) => (v === null ? "—" : v.toLocaleString("id-ID", { maximumFractionDigits: d }));

export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const fullAccess = user.isRecruiter || user.isAdminHr;
  if (!fullAccess && !user.isKadiv) redirect("/");

  const sp = await searchParams;
  const today = todayWib();
  const dari = parseIsoDate(sp.dari ?? "") ?? new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const sampai = parseIsoDate(sp.sampai ?? "") ?? today;
  const divisi = fullAccess ? sp.divisi || undefined : user.divisiKode;

  const where: Prisma.PrRequestWhereInput = {
    statusPersetujuan: { not: "DRAFT" },
    tanggalPengajuan: { gte: dari, lte: sampai },
    ...(divisi && { divisiKode: divisi }),
  };
  const [prs, holidays, divisions] = await Promise.all([
    prisma.prRequest.findMany({
      where,
      include: {
        candidates: { select: { status: true, tanggalJoin: true } },
        approvals: { select: { level: true, status: true, tanggal: true, approverNama: true, approverPeran: true } },
      },
    }),
    holidaySet(),
    fullAccess ? prisma.division.findMany({ orderBy: { kode: "asc" }, select: { kode: true } }) : Promise.resolve([]),
  ]);
  const r = computeReport(prs, { today, holidays, pics: RECRUITER_PIC, reminderDays: REMINDER_DAYS });

  const tiles: [string, number, string][] = [
    ["Menunggu Approval", r.statusCounts.MENUNGGU_APPROVAL, "MENUNGGU_APPROVAL"],
    ["Open", r.statusCounts.OPEN, "OPEN"],
    ["On Hold", r.statusCounts.ON_HOLD, "ON_HOLD"],
    ["Filled", r.statusCounts.FILLED, "FILLED"],
    ["Cancelled", r.statusCounts.CANCELLED, "CANCELLED"],
    ["Ditolak", r.statusCounts.DITOLAK, "DITOLAK"],
  ];
  const statusHref = (s: string) => (fullAccess ? `/rekrutmen?status=${s}${divisi ? `&divisi=${divisi}` : ""}&dari=${toIsoDate(dari)}&sampai=${toIsoDate(sampai)}` : null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Laporan & Metrik</h1>
          <p className="text-sm text-slate-500">
            {r.total} PR diajukan {fmtDate(dari)} – {fmtDate(sampai)}
            {divisi ? ` · Divisi ${divisi}` : " · semua divisi"}
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-xs text-slate-500">Dari<input type="date" name="dari" defaultValue={toIsoDate(dari)} className="input" /></label>
          <label className="text-xs text-slate-500">Sampai<input type="date" name="sampai" defaultValue={toIsoDate(sampai)} className="input" /></label>
          {fullAccess && (
            <label className="text-xs text-slate-500">Divisi
              <select name="divisi" defaultValue={divisi ?? ""} className="input">
                <option value="">Semua divisi</option>
                {divisions.map((d) => <option key={d.kode}>{d.kode}</option>)}
              </select>
            </label>
          )}
          <button className="btn btn-primary">Terapkan</button>
        </form>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([label, value, key]) => {
          const href = statusHref(key);
          const body = (<><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-bold tabular-nums">{value}</div></>);
          return href ? <Link key={key} href={href} className="card p-3 hover:border-brand-600">{body}</Link> : <div key={key} className="card p-3">{body}</div>;
        })}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="card">
          <div className="text-sm text-slate-500">Fulfillment rate</div>
          <div className="text-3xl font-bold tabular-nums">{pct(r.fulfillment.rate)}</div>
          <div className="mt-2 h-2 rounded-full bg-slate-100" aria-hidden>
            <div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.min(100, (r.fulfillment.rate ?? 0) * 100)}%` }} />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Σ Realisasi {r.fulfillment.realisasi} ÷ Σ Kebutuhan {r.fulfillment.kebutuhan} (PR disetujui).
            Tanpa PR Cancelled: {pct(r.fulfillmentExCancelled.rate)}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Rata-rata Placement Time</div>
          <div className="text-3xl font-bold tabular-nums">{num(r.placement.avg)} <span className="text-base font-normal">hari</span></div>
          <div className="mt-2 text-xs text-slate-500">PR Received → Fulfillment Date, hari kalender · {r.placement.n} PR Filled</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Rata-rata lama approval</div>
          <div className="text-3xl font-bold tabular-nums">{num(r.approvalDuration.avgCalendar)} <span className="text-base font-normal">hari</span></div>
          <div className="mt-2 text-xs text-slate-500">
            Tgl Pengajuan → PR Received · {num(r.approvalDuration.avgBusiness)} hari kerja · {r.approvalDuration.n} PR
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Rata-rata Placement Time per Divisi (hari)</h2>
          <HBarChart caption="Rata-rata placement time per divisi" unit="hari" data={r.placement.byDivisi.map((x) => ({ key: x.key, value: x.avg, n: x.n }))} />
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Rata-rata Placement Time per Job Level (hari)</h2>
          <HBarChart caption="Rata-rata placement time per job level" unit="hari" data={r.placement.byLevel.map((x) => ({ key: x.key, value: x.avg, n: x.n }))} />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">⚠ PR melewati Expected Date & belum Filled ({r.late.length})</h2>
        {r.late.length === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500 uppercase">
                <tr><th className="py-2 pr-3">PR NO</th><th className="pr-3">Job Title</th><th className="pr-3">Divisi</th><th className="pr-3">Status</th><th className="pr-3">PIC</th><th className="pr-3">Expected</th><th className="text-right">Terlambat</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.late.map(({ pr, daysLate }) => (
                  <tr key={pr.id}>
                    <td className="py-2 pr-3 whitespace-nowrap">{pr.prNo}</td>
                    <td className="pr-3"><Link href={`/pr/${pr.id}`} className="text-brand-700 hover:underline">{pr.jobTitle}</Link></td>
                    <td className="pr-3">{pr.divisiKode}</td>
                    <td className="pr-3">{pr.statusPermintaan === "ON_HOLD" ? "On Hold" : "Open"}</td>
                    <td className="pr-3">{pr.recruiterPic ?? "—"}</td>
                    <td className="pr-3 whitespace-nowrap">{fmtDate(pr.expectedDate)}</td>
                    <td className="text-right font-semibold text-red-700 tabular-nums">{daysLate} hari</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Beban kerja per Recruiter PIC</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500 uppercase">
              <tr><th className="py-2">PIC</th><th className="text-right">Open</th><th className="text-right">On Hold</th><th className="text-right">Posisi belum terisi</th><th className="text-right">Terlambat</th><th className="text-right">Filled</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {r.workload.map((w) => (
                <tr key={w.pic}>
                  <td className="py-2 font-medium">{w.pic}</td>
                  <td className="text-right">{w.open}</td>
                  <td className="text-right">{w.onHold}</td>
                  <td className="text-right">{w.outstanding}</td>
                  <td className={`text-right ${w.late ? "font-semibold text-red-700" : ""}`}>{w.late}</td>
                  <td className="text-right">{w.filled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Approval tertunda &gt; {REMINDER_DAYS} hari kerja ({r.pendingApprovals.length})</h2>
          {r.pendingApprovals.length === 0 ? (
            <p className="text-sm text-slate-500">Tidak ada.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {r.pendingApprovals.map((p) => (
                <li key={p.pr.id} className="flex justify-between gap-3 py-2">
                  <div>
                    <Link href={`/pr/${p.pr.id}`} className="font-medium text-brand-700 hover:underline">{p.pr.prNo} · {p.pr.jobTitle}</Link>
                    <div className="text-xs text-slate-500">Approval {p.step.level}: {p.step.approverNama} ({p.step.approverPeran}) · sejak {fmtDate(p.since)}</div>
                  </div>
                  <span className="shrink-0 font-semibold text-red-700 tabular-nums">{p.waiting} hari kerja</span>
                </li>
              ))}
            </ul>
          )}
          <p className="hint mt-2">Di production, approver menerima email pengingat otomatis (Fase 4).</p>
        </div>
      </section>
    </div>
  );
}
