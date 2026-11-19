import { requireUser } from "@/lib/auth/session";
import { NavLinks } from "@/components/NavLinks";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.isAdminHr)
    return <div className="card text-slate-600">Halaman ini khusus Admin HR.</div>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Admin HR</h1>
        <p className="text-sm text-slate-500">Semua perubahan tercatat di audit log (siapa & kapan).</p>
      </div>
      <div className="-mx-4 rounded-none border-y border-slate-200 bg-white sm:mx-0 sm:rounded-xl sm:border">
        <NavLinks
          links={[
            { href: "/admin/karyawan", label: "Karyawan & Hak Akses" },
            { href: "/admin/divisi", label: "Divisi (Kadiv & Direktur)" },
            { href: "/admin/approval", label: "Matriks Approval" },
            { href: "/admin/libur", label: "Hari Libur" },
            { href: "/admin/master", label: "Jurusan · Sertifikasi · Jabatan" },
            { href: "/admin/impor", label: "Impor Karyawan" },
            { href: "/admin/sistem", label: "Sistem & Audit" },
          ]}
        />
      </div>
      {children}
    </div>
  );
}
