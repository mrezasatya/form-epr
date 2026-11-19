import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { visiblePrWhere } from "@/lib/pr-queries";

export default async function HomePage() {
  const user = await requireUser();
  const where = visiblePrWhere(user);
  const [pendingMine, groups] = await Promise.all([
    prisma.prApproval.count({ where: { approverNik: user.nik, status: "PENDING", pr: { statusPersetujuan: "MENUNGGU_APPROVAL" } } }),
    prisma.prRequest.groupBy({ by: ["statusPersetujuan"], where, _count: true }),
  ]);
  const count = (s: string) => groups.find((g) => g.statusPersetujuan === s)?._count ?? 0;

  const tiles = [
    { label: "Draft", value: count("DRAFT"), href: "/pr?tab=draft" },
    { label: "Menunggu Approval", value: count("MENUNGGU_APPROVAL"), href: "/pr?tab=approval" },
    { label: "Disetujui", value: count("DISETUJUI"), href: "/pr?tab=disetujui" },
    { label: "Ditolak", value: count("DITOLAK"), href: "/pr?tab=ditolak" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Halo, {user.nama}</h1>
        <p className="text-sm text-slate-500">
          {user.jabatan} · {user.divisiKode}/{user.departemenKode}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {user.canRequest && (
          <Link href="/pr/baru" className="card flex items-center justify-between border-brand-600 bg-brand-600 text-white hover:bg-brand-700">
            <div>
              <div className="text-lg font-semibold">Buat PR baru</div>
              <div className="text-sm text-brand-100">Ajukan permintaan tenaga kerja</div>
            </div>
            <span className="text-2xl">+</span>
          </Link>
        )}
        <Link href="/approval" className={`card flex items-center justify-between ${pendingMine ? "border-amber-300 bg-amber-50" : ""}`}>
          <div>
            <div className="text-lg font-semibold">Menunggu approval Anda</div>
            <div className="text-sm text-slate-500">PR yang perlu Anda setujui/tolak</div>
          </div>
          <span className="text-3xl font-bold">{pendingMine}</span>
        </Link>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Ringkasan PR yang dapat Anda lihat</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className="card hover:border-brand-600">
              <div className="text-sm text-slate-500">{t.label}</div>
              <div className="text-2xl font-bold">{t.value}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
