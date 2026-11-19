import { PrismaClient } from "@prisma/client";
import {
  APPROVAL_RULES,
  DIREKTUR_PEMBINA,
  DIVISIONS,
  EMPLOYEES,
  HOLIDAYS_2026,
  JABATAN,
  JURUSAN,
  KADIV,
  SERTIFIKASI,
} from "./seed-data";

const prisma = new PrismaClient();

/**
 * Seed master data (idempoten). Karyawan dummy hanya dibuat bila
 * SEED_DUMMY=true (default di prototype) — JANGAN aktifkan di production.
 */
async function main() {
  const withDummy = (process.env.SEED_DUMMY ?? "true") === "true";

  // Insert per tabel sekaligus + skipDuplicates: cepat (juga ke database jauh seperti Neon) dan idempoten —
  // data yang sudah ada (termasuk yang diubah Admin HR) tidak ditimpa.
  await prisma.division.createMany({
    data: Object.keys(DIVISIONS).map((kode) => ({ kode, nama: kode })),
    skipDuplicates: true,
  });
  await prisma.department.createMany({
    data: Object.entries(DIVISIONS).flatMap(([divisiKode, depts]) => depts.map((kode) => ({ kode, divisiKode }))),
    skipDuplicates: true,
  });
  let i = 0;
  await prisma.masterJurusan.createMany({
    data: Object.entries(JURUSAN).flatMap(([kelompok, list]) => list.map((nama) => ({ nama, kelompok, urutan: i++ }))),
    skipDuplicates: true,
  });
  i = 0;
  await prisma.masterSertifikasi.createMany({
    data: Object.entries(SERTIFIKASI).flatMap(([kelompok, list]) => list.map((nama) => ({ nama, kelompok, urutan: i++ }))),
    skipDuplicates: true,
  });
  await prisma.masterJabatan.createMany({ data: JABATAN.map((nama) => ({ nama })), skipDuplicates: true });
  await prisma.holiday.createMany({
    data: HOLIDAYS_2026.map(([tgl, keterangan]) => ({ tanggal: new Date(`${tgl}T00:00:00Z`), keterangan })),
    skipDuplicates: true,
  });
  if ((await prisma.approvalRule.count()) === 0) {
    await prisma.approvalRule.createMany({
      data: APPROVAL_RULES.map((r) => ({ nama: r.nama, jobLevels: r.jobLevels, approvers: r.approvers })),
    });
  }

  if (withDummy) {
    await prisma.employee.createMany({
      data: EMPLOYEES.map((e) => ({
        nik: e.nik,
        nama: e.nama,
        jabatan: e.jabatan,
        jobLevel: e.jobLevel,
        divisiKode: e.divisiKode,
        departemenKode: e.departemenKode,
        email: `${e.nama.toLowerCase().split(" ")[0]}.${e.nik}@contoh.local`,
        atasanNik: e.atasanNik ?? null,
        roles: e.roles ?? [],
        isRequesterExtra: e.isRequesterExtra ?? false,
        extraDepartments: e.extraDepartments ?? [],
      })),
      skipDuplicates: true,
    });
    // Isi Kadiv & Direktur pembina hanya bila masih kosong (tidak menimpa pengaturan Admin HR)
    for (const [kode, nik] of Object.entries(KADIV))
      await prisma.division.updateMany({ where: { kode, kadivNik: null }, data: { kadivNik: nik } });
    for (const [kode, nik] of Object.entries(DIREKTUR_PEMBINA))
      await prisma.division.updateMany({ where: { kode, direkturPembinaNik: null }, data: { direkturPembinaNik: nik } });
  }

  console.log(`Seed selesai${withDummy ? " (dengan data dummy)" : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
