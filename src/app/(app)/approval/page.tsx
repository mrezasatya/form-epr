import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { fmtDate, fmtDateTime } from "@/lib/dates";

export const metadata = { title: "Approval" };

export default async function ApprovalInboxPage() {
  const user = await requireUser();
  const [pending, history] = await Promise.all([
    prisma.prApproval.findMany({
      where: { approverNik: user.nik, status: "PENDING", pr: { statusPersetujuan: "MENUNGGU_APPROVAL" } },
      include: { pr: true },
      orderBy: { pr: { tanggalPengajuan: "asc" } },
    }),
    prisma.prApproval.findMany({
      where: { approverNik: user.nik, status: { in: ["DISETUJUI", "DITOLAK"] } },
      include: { pr: true },
      orderBy: { tanggal: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Approval</h1>
      <section>
        <h2 className="mb-3 font-semibold">Menunggu keputusan Anda ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="card text-slate-500">Tidak ada PR yang menunggu persetujuan Anda.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((a) => (
              <Link key={a.id} href={`/pr/${a.prId}`} className="card block hover:border-brand-600">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{a.pr.prNo}</span>
                  <span>Approval {a.level}</span>
                </div>
                <div className="font-semibold">{a.pr.jobTitle}</div>
                <div className="text-sm text-slate-600">
                  {a.pr.jobLevel} · {a.pr.kebutuhan} orang · {a.pr.jenisKebutuhan}
                </div>
                <div className="text-sm text-slate-600">
                  {a.pr.requesterNama} · {a.pr.divisiKode}/{a.pr.departemenKode}
                </div>
                <div className="mt-2 text-xs text-slate-500">Diajukan {fmtDate(a.pr.tanggalPengajuan)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Riwayat keputusan</h2>
        {history.length === 0 ? (
          <div className="card text-slate-500">Belum ada.</div>
        ) : (
          <div className="card divide-y divide-slate-100 p-0">
            {history.map((a) => (
              <Link key={a.id} href={`/pr/${a.prId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <div>
                  <div className="font-medium">{a.pr.jobTitle}</div>
                  <div className="text-xs text-slate-500">{a.pr.prNo} · {fmtDateTime(a.tanggal)}</div>
                </div>
                <span className={`badge ${a.status === "DISETUJUI" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                  {a.status === "DISETUJUI" ? "Disetujui" : "Ditolak"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
