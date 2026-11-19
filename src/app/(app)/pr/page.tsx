import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { visiblePrWhere } from "@/lib/pr-queries";
import { fmtDate } from "@/lib/dates";
import { tahapRingkas } from "@/lib/constants";
import { fulfillmentDateOf, realisasi } from "@/lib/recruitment";
import { ApprovalBadge, RequestBadge } from "@/components/StatusBadge";
import { TimelineButton } from "@/components/TimelineButton";

export const metadata = { title: "Dashboard PR" };

const TABS: [string, string, Prisma.PrRequestWhereInput][] = [
  ["semua", "Semua", {}],
  ["draft", "Draft", { statusPersetujuan: "DRAFT" }],
  ["approval", "Menunggu Approval", { statusPersetujuan: "MENUNGGU_APPROVAL" }],
  ["open", "Open", { statusPermintaan: "OPEN" }],
  ["hold", "On Hold", { statusPermintaan: "ON_HOLD" }],
  ["filled", "Filled", { statusPermintaan: "FILLED" }],
  ["cancelled", "Cancelled", { statusPermintaan: "CANCELLED" }],
  ["ditolak", "Ditolak", { statusPersetujuan: "DITOLAK" }],
];

type Row = Awaited<ReturnType<typeof load>>[number];

async function load(where: Prisma.PrRequestWhereInput) {
  return prisma.prRequest.findMany({
    where,
    include: {
      approvals: { orderBy: { level: "asc" } },
      candidates: { orderBy: { tanggalJoin: "asc" } },
      actionRequests: { where: { status: "MENUNGGU" }, select: { jenis: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 300,
  });
}

/** Info kondisional (Spec 11): kandidat final, fulfillment, alasan hold, progress note. */
function Extra({ pr }: { pr: Row }) {
  const joined = pr.candidates.filter((c) => c.status === "Joined");
  const items: React.ReactNode[] = [];
  if (pr.statusPermintaan === "ON_HOLD")
    items.push(
      <div key="h" className="text-orange-800">
        <b>Hold:</b> {pr.alasanHold} · estimasi selesai {fmtDate(pr.estimasiSelesaiHold)}
      </div>,
    );
  if (joined.length)
    items.push(
      <div key="k">
        <b>Kandidat final:</b> {joined.map((c) => `${c.nama} (join ${fmtDate(c.tanggalJoin)})`).join(", ")}
      </div>,
    );
  if (pr.statusPermintaan === "FILLED")
    items.push(<div key="f"><b>Fulfillment:</b> {fmtDate(pr.fulfillmentDate ?? fulfillmentDateOf(pr.candidates))}</div>);
  if (pr.progressNote) items.push(<div key="p" className="text-slate-600"><b>Progress:</b> {pr.progressNote}</div>);
  if (pr.actionRequests.length)
    items.push(<div key="a" className="text-red-700">Pengajuan {pr.actionRequests[0].jenis} menunggu rekruter</div>);
  return items.length ? <div className="space-y-0.5 text-xs">{items}</div> : null;
}

function Status({ pr }: { pr: Row }) {
  const current = pr.approvals.find((a) => a.level === pr.currentLevel);
  const badge = <ApprovalBadge status={pr.statusPersetujuan} level={pr.currentLevel} approverPeran={current?.approverPeran} />;
  return pr.approvals.length ? <TimelineButton steps={pr.approvals} prNo={pr.prNo}>{badge}</TimelineButton> : badge;
}

const href = (pr: Row) => (pr.statusPersetujuan === "DRAFT" ? `/pr/baru?draft=${pr.id}` : `/pr/${pr.id}`);

export default async function PrListPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; draft?: string }> }) {
  const user = await requireUser();
  const { tab = "semua", q = "", draft } = await searchParams;
  const tabWhere = TABS.find((t) => t[0] === tab)?.[2] ?? {};
  const search: Prisma.PrRequestWhereInput = q
    ? { OR: [{ jobTitle: { contains: q, mode: "insensitive" } }, { prNo: { contains: q } }, { requesterNama: { contains: q, mode: "insensitive" } }] }
    : {};
  const prs = await load({ AND: [visiblePrWhere(user), tabWhere, search] });

  const title = user.isRecruiter || user.isAdminHr ? "Semua PR" : user.isKadiv ? `PR Divisi ${user.divisiKode}` : "PR Saya";

  return (
    <div className="space-y-4">
      {draft && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Draft tersimpan.</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="text-sm text-slate-500">Klik Job Title untuk isian lengkap, klik Status Persetujuan untuk timeline approval.</p>
        </div>
        {user.canRequest && <Link href="/pr/baru" className="btn btn-primary">+ Buat PR</Link>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {TABS.map(([key, label]) => (
            <Link
              key={key}
              href={`/pr?tab=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${tab === key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
            >
              {label}
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
          <div className="space-y-3 lg:hidden">
            {prs.map((pr) => (
              <article key={pr.id} className="card space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{pr.prNo ?? "Draft"}</span>
                  <span>{fmtDate(pr.tanggalPengajuan ?? pr.createdAt)}</span>
                </div>
                <Link href={href(pr)} className="block text-base font-semibold text-brand-700">{pr.jobTitle || "(tanpa judul)"}</Link>
                <div className="text-sm text-slate-600">
                  {pr.divisiKode}/{pr.departemenKode} · {pr.requesterNama}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><div className="text-xs text-slate-500">Realisasi/Kebutuhan</div><b>{realisasi(pr.candidates)}/{pr.kebutuhan}</b></div>
                  <div><div className="text-xs text-slate-500">Expected Date</div><b>{fmtDate(pr.expectedDate)}</b></div>
                  {pr.statusPersetujuan === "DISETUJUI" && (
                    <>
                      <div><div className="text-xs text-slate-500">Status Permintaan</div><RequestBadge status={pr.statusPermintaan} /></div>
                      <div><div className="text-xs text-slate-500">Tahap</div><b>{tahapRingkas(pr.tahapDetail)}</b></div>
                    </>
                  )}
                </div>
                <Status pr={pr} />
                <Extra pr={pr} />
              </article>
            ))}
          </div>

          {/* Tabel (desktop) */}
          <div className="card hidden overflow-x-auto p-0 lg:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-3">PR NO</th>
                  <th className="px-3 py-3">Tgl Pengajuan</th>
                  <th className="px-3 py-3">Job Title</th>
                  <th className="px-3 py-3">Divisi</th>
                  <th className="px-3 py-3 text-center">Real./Keb.</th>
                  <th className="px-3 py-3">Status Persetujuan</th>
                  <th className="px-3 py-3">Status Permintaan</th>
                  <th className="px-3 py-3">Tahap</th>
                  <th className="px-3 py-3">Expected</th>
                  <th className="px-3 py-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prs.map((pr) => (
                  <tr key={pr.id} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-3 whitespace-nowrap">{pr.prNo ?? <span className="text-slate-400">Draft</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(pr.tanggalPengajuan)}</td>
                    <td className="px-3 py-3">
                      <Link className="font-medium text-brand-700 hover:underline" href={href(pr)}>{pr.jobTitle || "(tanpa judul)"}</Link>
                      <div className="text-xs text-slate-500">{pr.requesterNama}</div>
                    </td>
                    <td className="px-3 py-3">{pr.divisiKode}<div className="text-xs text-slate-500">{pr.departemenKode}</div></td>
                    <td className="px-3 py-3 text-center">{realisasi(pr.candidates)}/{pr.kebutuhan}</td>
                    <td className="px-3 py-3"><Status pr={pr} /></td>
                    <td className="px-3 py-3"><RequestBadge status={pr.statusPermintaan} /></td>
                    <td className="px-3 py-3">{pr.statusPersetujuan === "DISETUJUI" ? tahapRingkas(pr.tahapDetail) : "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(pr.expectedDate)}</td>
                    <td className="max-w-xs px-3 py-3">
                      <Extra pr={pr} />
                      {pr.statusPersetujuan === "DISETUJUI" && (
                        <Link href={`/pr/${pr.id}#riwayat`} className="text-xs text-brand-700 hover:underline">Riwayat aksi</Link>
                      )}
                    </td>
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
