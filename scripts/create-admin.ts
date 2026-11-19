/**
 * Membuat / memulihkan akun Admin HR (dipakai saat instalasi pertama di production,
 * atau bila semua Admin HR terkunci). Contoh:
 *   npx tsx scripts/create-admin.ts --nik 123456 --nama "Nama Admin" --divisi HRD --departemen HRD \
 *       --jabatan "HR Admin" --email admin@perusahaan.co.id
 * Dengan Docker:
 *   docker compose run --rm migrate npx tsx scripts/create-admin.ts --nik ... (argumen sama)
 * Bila AUTH_MODE=local, password sementara dicetak sekali di layar.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1] ?? ""]);
    return acc;
  }, []),
);

async function main() {
  const prisma = new PrismaClient();
  const nik = args.nik;
  if (!nik || !/^[A-Za-z0-9._-]{3,20}$/.test(nik)) throw new Error("--nik wajib (3–20 karakter).");
  const existing = await prisma.employee.findUnique({ where: { nik } });
  const divisi = args.divisi ?? existing?.divisiKode ?? "HRD";
  const departemen = args.departemen ?? existing?.departemenKode ?? "HRD";
  await prisma.division.upsert({ where: { kode: divisi }, update: {}, create: { kode: divisi, nama: divisi } });
  await prisma.department.upsert({
    where: { divisiKode_kode: { divisiKode: divisi, kode: departemen } },
    update: {},
    create: { divisiKode: divisi, kode: departemen },
  });
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const temp = [...Array(10)].map(() => alphabet[randomInt(alphabet.length)]).join("") + randomInt(10, 99);
  const roles = Array.from(new Set([...(existing?.roles ?? []), "ADMIN_HR"]));
  const data = {
    nama: args.nama ?? existing?.nama ?? "Admin HR",
    jabatan: args.jabatan ?? existing?.jabatan ?? "HR Admin",
    jobLevel: args.level ?? existing?.jobLevel ?? "Office Staff",
    divisiKode: divisi,
    departemenKode: departemen,
    email: args.email ?? existing?.email ?? null,
    roles,
    aktif: true,
    passwordHash: await bcrypt.hash(temp, 12),
    mustChangePassword: true,
    failedLogins: 0,
    lockedUntil: null,
  };
  await prisma.employee.upsert({
    where: { nik },
    update: { ...data, sessionVersion: { increment: 1 } },
    create: { nik, ...data },
  });
  await prisma.auditLog.create({
    data: { entitas: "EMPLOYEE", entitasId: nik, aksi: existing ? "BOOTSTRAP_ADMIN_UPDATE" : "BOOTSTRAP_ADMIN_CREATE", olehNik: "CLI", olehNama: "scripts/create-admin" },
  });
  console.log(`Admin HR ${existing ? "diperbarui" : "dibuat"}: ${data.nama} (NIK ${nik}).`);
  if ((process.env.AUTH_MODE ?? "dummy") === "local") console.log(`Password sementara: ${temp}  (wajib diganti saat login pertama)`);
  else console.log(`AUTH_MODE=${process.env.AUTH_MODE ?? "dummy"}: login memakai ${process.env.AUTH_MODE === "ldap" ? "password ESS/AD" : "mode dummy"}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Gagal:", e.message);
  process.exit(1);
});
