import Link from "next/link";
import { redirect } from "next/navigation";
import { authMode, getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ganti Password" };

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ wajib?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const mode = authMode();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-xl font-bold">Ganti Password</h1>
      <p className="mb-4 text-sm text-slate-500">{user.nama} · NIK {user.nik}</p>
      {mode === "local" ? (
        <ChangePasswordForm wajib={user.mustChangePassword || (await searchParams).wajib === "1"} />
      ) : (
        <div className="card text-sm text-slate-600">Password dikelola oleh ESS / Active Directory. Gunakan prosedur ganti password dari IT.</div>
      )}
      <div className="mt-4 flex justify-between text-sm">
        {!user.mustChangePassword ? <Link href="/" className="text-brand-700 hover:underline">← Kembali</Link> : <span />}
        <form action={logout}><button className="text-slate-500 hover:underline">Keluar</button></form>
      </div>
    </main>
  );
}
