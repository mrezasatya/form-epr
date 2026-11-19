import Link from "next/link";
import { prisma } from "@/lib/db";
import { DEFAULT_REQUESTER_LEVELS } from "@/lib/constants";

export const metadata = { title: "Karyawan · Admin HR" };

const ROLE_LABEL: Record<string, string> = {
  ADMIN_HR: "Admin HR",
  RECRUITER: "Rekruter",
  KEPALA_HRD: "Kepala HRD",
  DIREKTUR_UTAMA: "Direktur Utama",
};

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; divisi?: string; saved?: string }> }) {
  const { q = "", divisi = "", saved } = await searchParams;
  const [employees, divisions] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...(divisi && { divisiKode: divisi }),
        ...(q && { OR: [{ nama: { contains: q, mode: "insensitive" } }, { nik: { contains: q } }, { jabatan: { contains: q, mode: "insensitive" } }] }),
      },
      include: { division: { select: { kadivNik: true, direkturPembinaNik: true } } },
      orderBy: [{ divisiKode: "asc" }, { nama: "asc" }],
      take: 300,
    }),
    prisma.division.findMany({ orderBy: { kode: "asc" }, select: { kode: true } }),
  ]);

  return (
    <div className="space-y-3">
      {saved && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Data karyawan {saved} tersimpan.</div>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form className="flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Cari nama / NIK / jabatan" className="input sm:w-64" />
          <select name="divisi" defaultValue={divisi} className="input sm:w-40">
            <option value="">Semua divisi</option>
            {divisions.map((d) => <option key={d.kode}>{d.kode}</option>)}
          </select>
          <button className="btn btn-secondary">Cari</button>
        </form>
        <Link href="/admin/karyawan/baru" className="btn btn-primary">+ Tambah Karyawan</Link>
      </div>
      <p className="text-xs text-slate-500">
        Pemohon otomatis: {DEFAULT_REQUESTER_LEVELS.join(", ")}. Section Head / PM dapat diberi hak pemohon tambahan. Di production, data
        karyawan diimpor dari HRIS/ESS (Fase 4).
      </p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr><th className="px-3 py-2">NIK</th><th className="px-3 py-2">Nama / Jabatan</th><th className="px-3 py-2">Divisi / Dept</th><th className="px-3 py-2">Job Level</th><th className="px-3 py-2">Peran & Hak</th><th className="px-3 py-2">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((e) => {
              const tags = [
                ...e.roles.map((r) => ROLE_LABEL[r] ?? r),
                e.division.kadivNik === e.nik && "Kadiv",
                DEFAULT_REQUESTER_LEVELS.includes(e.jobLevel) ? "Pemohon" : e.isRequesterExtra ? "Pemohon (tambahan)" : null,
                e.extraDepartments.length ? `+${e.extraDepartments.length} dept` : null,
              ].filter(Boolean) as string[];
              return (
                <tr key={e.nik} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono">{e.nik}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/karyawan/${encodeURIComponent(e.nik)}`} className="font-medium text-brand-700 hover:underline">{e.nama}</Link>
                    <div className="text-xs text-slate-500">{e.jabatan}</div>
                  </td>
                  <td className="px-3 py-2">{e.divisiKode}<div className="text-xs text-slate-500">{e.departemenKode}</div></td>
                  <td className="px-3 py-2">{e.jobLevel}</td>
                  <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{tags.map((t) => <span key={t} className="badge bg-brand-50 text-brand-800">{t}</span>)}</div></td>
                  <td className="px-3 py-2">{e.aktif ? <span className="badge bg-emerald-100 text-emerald-800">Aktif</span> : <span className="badge bg-slate-200 text-slate-600">Nonaktif</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
