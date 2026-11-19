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

  for (const [kode, depts] of Object.entries(DIVISIONS)) {
    await prisma.division.upsert({ where: { kode }, update: {}, create: { kode, nama: kode } });
    for (const d of depts) {
      await prisma.department.upsert({
        where: { divisiKode_kode: { divisiKode: kode, kode: d } },
        update: {},
        create: { kode: d, divisiKode: kode },
      });
    }
  }

  let i = 0;
  for (const [kelompok, list] of Object.entries(JURUSAN)) {
    for (const nama of list) {
      await prisma.masterJurusan.upsert({ where: { nama }, update: {}, create: { nama, kelompok, urutan: i++ } });
    }
  }
  i = 0;
  for (const [kelompok, list] of Object.entries(SERTIFIKASI)) {
    for (const nama of list) {
      await prisma.masterSertifikasi.upsert({ where: { nama }, update: {}, create: { nama, kelompok, urutan: i++ } });
    }
  }
  for (const nama of JABATAN) {
    await prisma.masterJabatan.upsert({ where: { nama }, update: {}, create: { nama } });
  }
  for (const [tgl, keterangan] of HOLIDAYS_2026) {
    const tanggal = new Date(`${tgl}T00:00:00Z`);
    await prisma.holiday.upsert({ where: { tanggal }, update: { keterangan }, create: { tanggal, keterangan } });
  }

  if ((await prisma.approvalRule.count()) === 0) {
    for (const r of APPROVAL_RULES) {
      await prisma.approvalRule.create({ data: { nama: r.nama, jobLevels: r.jobLevels, approvers: r.approvers } });
    }
  }

  if (withDummy) {
    for (const e of EMPLOYEES) {
      const data = {
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
      };
      await prisma.employee.upsert({ where: { nik: e.nik }, update: data, create: { nik: e.nik, ...data } });
    }
    for (const [kode, nik] of Object.entries(KADIV)) {
      await prisma.division.update({ where: { kode }, data: { kadivNik: nik } });
    }
    for (const [kode, nik] of Object.entries(DIREKTUR_PEMBINA)) {
      await prisma.division.update({ where: { kode }, data: { direkturPembinaNik: nik } });
    }
  }

  console.log(`Seed selesai${withDummy ? " (dengan data dummy)" : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
