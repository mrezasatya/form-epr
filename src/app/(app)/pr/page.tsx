import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { visiblePrWhere } from "@/lib/pr-queries";
import { fmtDate } from "@/lib/dates";
import { tahapRingkas } from "@/lib/constants";
import { ApprovalBadge, RequestBadge } from "@/components/StatusBadge";

export const metadata = { title: "Daftar PR" };

const TABS = [
  { key: "semua", label: "Semua" },
  { key: "draft", label: "Draft" },
  { key: "approval", label: "Menunggu Approval" },
  { key: "disetujui", label: "Disetujui" },
  { key: "ditolak", label: "Ditolak" },
] as const;

const TAB_WHERE: Record<string, Prisma.PrRequestWhereInput> = {
  draft: { statusPersetujuan: "DRAFT" },
  approval: { statusPersetujuan: "MENUNGGU_APPROVAL" },
  disetujui: { statusPersetujuan: "DISETUJUI" },
  ditolak: { statusPersetujuan: "DITOLAK" },
};

export default async function PrListPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; draft?: string }> }) {
  const user = await requireUser();
  const { tab = "semua", q = "", draft } = await searchParams;
  const search: Prisma.PrRequestWhereInput = q
    ? { OR: [{ jobTitle: { contains: q, mode: "insensitive" } }, { prNo: { contains: q } }, { requesterNama: { contains: q, mode: "insensitive" } }] }
    : {};
  const prs = await prisma.prRequest.findMany({
    where: { AND: [visiblePrWhere(user), TAB_WHERE[tab] ?? {}, search] },
    include: {
      approvals: { where: { status: "PENDING" }, select: { approverPeran: true, approverNama: true } },
      candidates: { where: { status: "Joined" }, select: { id: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });

  const title = user.isRecruiter || user.isAdminHr ? "Semua PR" : user.isKadiv ? "PR Divisi " + user.divisiKode : "PR Saya";

  return (
    <div className="space-y-4">
      {draft && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Draft tersimpan.</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{title}</h1>
        {user.canRequest && (
          <Link href="/pr/baru" className="btn btn-primary">
            + Buat PR
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/pr?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${tab === t.key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={q} placeholder="Cari PR NO / Job Title / pemohon" className="input sm:w-72" />
        </form>
      </div>

      {prs.length === 0 ? (
        <div className="card text-center text-slate-500">Belum ada PR.</div>
      ) : (
        <>
          {/* Kartu (HP) */}
          <div className="space-y-3 md:hidden">
            {prs.map((pr) => (
              <Link key={pr.id} href={pr.statusPersetujuan === "DRAFT" ? `/pr/baru?draft=${pr.id}` : `/pr/${pr.id}`} className="card block">
                <div className="text-xs text-slate-500">{pr.prNo ?? "Draft"} · {fmtDate(pr.tanggalPengajuan ?? pr.createdAt)}</div>
                <div className="font-semibold">{pr.jobTitle || "(tanpa judul)"}</div>
                <div className="text-sm text-slate-600">{pr.divisiKode}/{pr.departemenKode} · {pr.kebutuhan} orang · {pr.requesterNama}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ApprovalBadge status={pr.statusPersetujuan} level={pr.currentLevel} approverPeran={pr.approvals[0]?.approverPeran} />
                  {pr.statusPermintaan && <RequestBadge status={pr.statusPermintaan} />}
                </div>
              </Link>
            ))}
          </div>
          {/* Tabel (desktop) */}
          <div className="card hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">PR NO</th>
                  <th className="px-4 py-3">Tgl Pengajuan</th>
                  <th className="px-4 py-3">Job Title</th>
                  <th className="px-4 py-3">Divisi</th>
                  <th className="px-4 py-3">Keb./Real.</th>
                  <th className="px-4 py-3">Status Persetujuan</th>
                  <th className="px-4 py-3">Status Permintaan</th>
                  <th className="px-4 py-3">Tahap</th>
                  <th className="px-4 py-3">Expected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prs.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">{pr.prNo ?? <span className="text-slate-400">Draft</span>}</td>
                    <td className="px-4 py-3">{fmtDate(pr.tanggalPengajuan)}</td>
                    <td className="px-4 py-3">
                      <Link className="font-medium text-brand-700 hover:underline" href={pr.statusPersetujuan === "DRAFT" ? `/pr/baru?draft=${pr.id}` : `/pr/${pr.id}`}>
                        {pr.jobTitle || "(tanpa judul)"}
                      </Link>
                      <div className="text-xs text-slate-500">{pr.requesterNama}</div>
                    </td>
                    <td className="px-4 py-3">{pr.divisiKode}<div className="text-xs text-slate-500">{pr.departemenKode}</div></td>
                    <td className="px-4 py-3">{pr.kebutuhan}/{pr.candidates.length}</td>
                    <td className="px-4 py-3"><ApprovalBadge status={pr.statusPersetujuan} level={pr.currentLevel} approverPeran={pr.approvals[0]?.approverPeran} /></td>
                    <td className="px-4 py-3"><RequestBadge status={pr.statusPermintaan} /></td>
                    <td className="px-4 py-3">{pr.statusPersetujuan === "DISETUJUI" ? tahapRingkas(pr.tahapDetail) : "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(pr.expectedDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
