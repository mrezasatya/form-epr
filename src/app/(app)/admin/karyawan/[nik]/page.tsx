import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/dates";
import { EmployeeForm } from "@/components/admin/EmployeeForm";
import { ResetPasswordPanel } from "@/components/admin/ResetPasswordPanel";
import { authMode } from "@/lib/auth/session";

export const metadata = { title: "Karyawan · Admin HR" };

export default async function EmployeeEditPage({ params }: { params: Promise<{ nik: string }> }) {
  const nik = decodeURIComponent((await params).nik);
  const isNew = nik === "baru";
  const [employee, departments, logs] = await Promise.all([
    isNew ? null : prisma.employee.findUnique({ where: { nik } }),
    prisma.department.findMany({ orderBy: [{ divisiKode: "asc" }, { kode: "asc" }], select: { divisiKode: true, kode: true } }),
    isNew ? [] : prisma.auditLog.findMany({ where: { entitas: "EMPLOYEE", entitasId: nik }, orderBy: { waktu: "desc" }, take: 10 }),
  ]);
  if (!isNew && !employee) notFound();
  return (
    <div className="max-w-3xl space-y-3">
      <Link href="/admin/karyawan" className="text-sm text-brand-700 hover:underline">← Daftar karyawan</Link>
      <h2 className="text-lg font-semibold">{isNew ? "Tambah Karyawan" : `${employee!.nama} (${employee!.nik})`}</h2>
      <EmployeeForm employee={employee} departments={departments} />
      {employee && authMode() === "local" && (
        <ResetPasswordPanel
          nik={employee.nik}
          hasPassword={!!employee.passwordHash}
          locked={!!employee.lockedUntil && employee.lockedUntil > new Date()}
        />
      )}
      {logs.length > 0 && (
        <section className="card text-sm">
          <h3 className="mb-2 font-semibold">Riwayat perubahan</h3>
          <ul className="space-y-1 text-slate-600">
            {logs.map((l) => <li key={l.id}>{fmtDateTime(l.waktu)} · {l.aksi} oleh {l.olehNama}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
