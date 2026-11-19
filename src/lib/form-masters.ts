import "server-only";
import { prisma } from "./db";
import type { CurrentUser } from "./auth/session";
import { todayWib, toIsoDate } from "./dates";
import { allowedDepartments, defaultExpectedDate } from "./pr-service";
import type { PrFormMasters } from "@/components/PrForm";

export async function loadFormMasters(user: NonNullable<CurrentUser>): Promise<PrFormMasters> {
  const today = todayWib();
  const [departments, jurusan, sertifikasi, jabatan, employees, expected] = await Promise.all([
    allowedDepartments(user),
    prisma.masterJurusan.findMany({ orderBy: { urutan: "asc" }, select: { nama: true, kelompok: true } }),
    prisma.masterSertifikasi.findMany({ orderBy: { urutan: "asc" }, select: { nama: true, kelompok: true } }),
    prisma.masterJabatan.findMany({ orderBy: { nama: "asc" }, select: { nama: true } }),
    prisma.employee.findMany({
      where: { divisiKode: user.divisiKode, aktif: true },
      orderBy: { nama: "asc" },
      select: { nik: true, nama: true, jabatan: true, departemenKode: true },
    }),
    defaultExpectedDate(today),
  ]);
  return {
    departments,
    jurusan,
    sertifikasi,
    jabatan: jabatan.map((j) => j.nama),
    employees,
    todayIso: toIsoDate(today),
    defaultExpectedIso: toIsoDate(expected),
  };
}
