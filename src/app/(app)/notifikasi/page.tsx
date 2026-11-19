import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/dates";

export const metadata = { title: "Notifikasi" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ semua?: string }> }) {
  const user = await requireUser();
  const { semua } = await searchParams;
  const canSeeAll = user.isAdminHr || user.isRecruiter;
  const all = canSeeAll && semua === "1";
  const logs = await prisma.notificationLog.findMany({
    where: all ? {} : { penerimaNik: user.nik },
    orderBy: { waktu: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Notifikasi Email</h1>
          <p className="text-sm text-slate-500">
            Prototype: email tidak benar-benar dikirim, melainkan dicatat di sini sesuai pemicu pada spesifikasi.
          </p>
        </div>
        {canSeeAll && (
          <Link href={all ? "/notifikasi" : "/notifikasi?semua=1"} className="btn btn-secondary">
            {all ? "Hanya untuk saya" : "Lihat semua (log sistem)"}
          </Link>
        )}
      </div>
      {logs.length === 0 ? (
        <div className="card text-slate-500">Belum ada notifikasi.</div>
      ) : (
        <div className="space-y-3">
          {logs.map((n) => (
            <article key={n.id} className="card">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                <span>Kepada: {n.penerima}</span>
                <span>{fmtDateTime(n.waktu)} · {n.statusKirim}</span>
              </div>
              <h2 className="mt-1 font-semibold">{n.subjek}</h2>
              <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{n.isi}</p>
              {n.prId && (
                <Link href={`/pr/${n.prId}`} className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
                  Buka PR →
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
