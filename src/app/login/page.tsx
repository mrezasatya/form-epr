import { prisma } from "@/lib/db";
import { authMode } from "@/lib/auth/session";
import { loginDummy } from "@/app/actions/auth";
import { PasswordLoginForm } from "@/components/PasswordLoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Masuk" };

const GROUPS: { title: string; match: (e: { jobLevel: string; roles: string[]; isRequesterExtra: boolean }) => boolean }[] = [
  { title: "Direksi", match: (e) => e.jobLevel === "Director" },
  { title: "Kepala Divisi", match: (e) => e.jobLevel === "Division Head" },
  { title: "Pemohon (Dept Head / Section Head / PM)", match: (e) => e.jobLevel === "Department Head" || e.isRequesterExtra },
  { title: "Tim HR (Rekruter & Admin HR)", match: (e) => e.roles.includes("RECRUITER") || e.roles.includes("ADMIN_HR") },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const mode = authMode();
  const employees =
    mode === "dummy"
      ? await prisma.employee.findMany({ where: { aktif: true }, orderBy: { nik: "asc" } })
      : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
          PR
        </div>
        <h1 className="text-2xl font-bold">e-PR · Personnel Request</h1>
        <p className="text-sm text-slate-500">Pengajuan, approval, dan monitoring permintaan tenaga kerja</p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Akun tidak ditemukan atau tidak aktif.</p>}

      {mode === "dummy" ? (
        <div className="card">
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <b>Mode prototype.</b> Pilih akun dummy untuk mencoba setiap peran. Di production, login memakai
            NIK + password ESS.
          </div>
          {GROUPS.map((g) => {
            const list = employees.filter(g.match);
            if (!list.length) return null;
            return (
              <section key={g.title} className="mb-5">
                <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{g.title}</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map((e) => (
                    <form key={e.nik} action={loginDummy}>
                      <input type="hidden" name="nik" value={e.nik} />
                      <input type="hidden" name="next" value={next ?? "/"} />
                      <button className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-brand-600 hover:bg-brand-50">
                        <div className="font-medium">{e.nama}</div>
                        <div className="text-xs text-slate-500">
                          {e.jabatan} · {e.divisiKode}/{e.departemenKode} · NIK {e.nik}
                        </div>
                      </button>
                    </form>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <PasswordLoginForm next={next ?? "/"} mode={mode} />
      )}
    </main>
  );
}
