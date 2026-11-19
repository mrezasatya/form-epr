import Link from "next/link";
import { authMode, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logout } from "@/app/actions/auth";
import { NavLinks } from "@/components/NavLinks";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const pendingApprovals = await prisma.prApproval.count({
    where: { approverNik: user.nik, status: "PENDING", pr: { statusPersetujuan: "MENUNGGU_APPROVAL" } },
  });

  const pendingRequests =
    user.isRecruiter || user.isAdminHr ? await prisma.prActionRequest.count({ where: { status: "MENUNGGU" } }) : 0;

  const links = [
    { href: "/", label: "Beranda" },
    ...(user.canRequest ? [{ href: "/pr/baru", label: "Buat PR" }] : []),
    ...(user.isRecruiter || user.isAdminHr ? [{ href: "/rekrutmen", label: "Dashboard Rekruter", badge: pendingRequests }] : []),
    { href: "/pr", label: user.isRecruiter || user.isAdminHr ? "Semua PR" : user.isKadiv ? "PR Divisi" : "PR Saya" },
    { href: "/approval", label: "Approval", badge: pendingApprovals },
    ...(user.isRecruiter || user.isAdminHr || user.isKadiv ? [{ href: "/laporan", label: "Laporan" }] : []),
    ...(user.isAdminHr ? [{ href: "/admin", label: "Admin HR" }] : []),
    { href: "/notifikasi", label: "Notifikasi" },
  ];

  const peran = [
    user.isDireksi && "Direksi",
    user.isKadiv && "Kadiv",
    user.canRequest && "Pemohon",
    user.isRecruiter && "Rekruter",
    user.isAdminHr && "Admin HR",
    user.roles.includes("KEPALA_HRD") && "Kepala HRD",
  ].filter(Boolean);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs text-white">PR</span>
            <span>e-PR</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{user.nama}</div>
              <div className="text-xs text-slate-500">{peran.join(" · ") || user.jabatan}</div>
            </div>
            {authMode() === "local" && (
              <Link href="/akun/password" className="hidden text-xs text-slate-500 hover:underline sm:inline">Ganti password</Link>
            )}
            <form action={logout}>
              <button className="btn btn-secondary min-h-9 px-3 py-1.5 text-xs">Keluar</button>
            </form>
          </div>
        </div>
        <NavLinks links={links} />
      </header>
      {authMode() === "dummy" && (
        <div className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900">
          PROTOTYPE — data dummy, email disimulasikan di menu Notifikasi
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-5 pb-16">{children}</main>
    </div>
  );
}
