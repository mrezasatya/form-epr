import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { CurrentUser } from "./auth/session";
import { APPROVER_ROLES, EMPLOYEE_JOB_LEVELS, JENIS_KEBUTUHAN, JOB_LEVELS, ROLES, STATUS_EMPLOYMENT } from "./constants";
import { parseIsoDate, toIsoDate } from "./dates";
import { generateTempPassword, hashPassword } from "./auth/password";

type User = NonNullable<CurrentUser>;
export type AdminResult = { ok: true; message?: string; id?: string } | { ok: false; message: string };

class Fail extends Error {}
const fail = (m: string): never => {
  throw new Fail(m);
};

/** Bungkus aksi admin: cek peran, tangkap error bisnis & duplikasi. */
async function adminOnly(user: User, fn: () => Promise<AdminResult | void>): Promise<AdminResult> {
  if (!user.isAdminHr) return { ok: false, message: "Hanya Admin HR yang dapat mengubah data ini." };
  try {
    return (await fn()) ?? { ok: true, message: "Tersimpan." };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, message: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { ok: false, message: "Data dengan nilai yang sama sudah ada." };
    throw e;
  }
}

async function audit(user: User, entitas: string, entitasId: string, aksi: string, data?: unknown) {
  await prisma.auditLog.create({
    data: {
      entitas,
      entitasId,
      aksi,
      data: data === undefined ? Prisma.JsonNull : (JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue),
      olehNik: user.nik,
      olehNama: user.nama,
    },
  });
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ---------------------------------------------------------------------------
// Karyawan (master karyawan + peran + hak pemohon tambahan)
// ---------------------------------------------------------------------------

export async function saveEmployee(user: User, fd: FormData, isNew: boolean): Promise<AdminResult> {
  return adminOnly(user, async () => {
    const nik = str(fd, "nik");
    const data = {
      nama: str(fd, "nama").slice(0, 100),
      jabatan: str(fd, "jabatan").slice(0, 100),
      jobLevel: str(fd, "jobLevel"),
      divisiKode: str(fd, "divisiKode"),
      departemenKode: str(fd, "departemenKode"),
      email: str(fd, "email").slice(0, 150) || null,
      atasanNik: str(fd, "atasanNik") || null,
      roles: fd.getAll("roles").map(String).filter((r) => Object.values(ROLES).includes(r as never)),
      isRequesterExtra: fd.get("isRequesterExtra") === "on",
      extraDepartments: fd.getAll("extraDepartments").map(String),
      aktif: fd.get("aktif") === "on",
    };
    if (!/^[A-Za-z0-9._-]{3,20}$/.test(nik)) fail("NIK 3–20 karakter (huruf, angka, titik, strip).");
    if (!data.nama) fail("Nama wajib diisi.");
    if (!data.jabatan) fail("Jabatan wajib diisi.");
    if (!EMPLOYEE_JOB_LEVELS.includes(data.jobLevel as never)) fail("Job Level wajib dipilih.");
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fail("Format email tidak valid.");
    const dept = await prisma.department.findUnique({
      where: { divisiKode_kode: { divisiKode: data.divisiKode, kode: data.departemenKode } },
    });
    if (!dept) fail("Departemen tidak sesuai dengan divisi.");
    const validDepts = (await prisma.department.findMany({ where: { divisiKode: data.divisiKode } })).map((d) => d.kode);
    data.extraDepartments = data.extraDepartments.filter((d) => validDepts.includes(d) && d !== data.departemenKode);
    if (data.atasanNik && data.atasanNik === nik) fail("Atasan tidak boleh diri sendiri.");
    if (data.atasanNik && !(await prisma.employee.findUnique({ where: { nik: data.atasanNik } })))
      fail("NIK atasan tidak ditemukan.");
    if (nik === user.nik && !data.roles.includes(ROLES.ADMIN_HR))
      fail("Anda tidak dapat mencabut peran Admin HR dari akun sendiri.");

    if (isNew) {
      if (await prisma.employee.findUnique({ where: { nik } })) fail(`NIK ${nik} sudah terdaftar.`);
      await prisma.employee.create({ data: { nik, ...data } });
      await audit(user, "EMPLOYEE", nik, "CREATE", data);
    } else {
      const before = await prisma.employee.findUnique({ where: { nik } });
      if (!before) fail("Karyawan tidak ditemukan.");
      await prisma.employee.update({ where: { nik }, data });
      await audit(user, "EMPLOYEE", nik, "UPDATE", { before, after: data });
    }
    return { ok: true, message: "Data karyawan tersimpan.", id: nik };
  });
}

// ---------------------------------------------------------------------------
// Divisi: Kadiv & Direktur pembina
// ---------------------------------------------------------------------------

export async function saveDivision(user: User, fd: FormData): Promise<AdminResult> {
  return adminOnly(user, async () => {
    const kode = str(fd, "kode");
    const kadivNik = str(fd, "kadivNik") || null;
    const direkturPembinaNik = str(fd, "direkturPembinaNik") || null;
    const div = await prisma.division.findUnique({ where: { kode } });
    if (!div) fail("Divisi tidak ditemukan.");
    for (const nik of [kadivNik, direkturPembinaNik].filter(Boolean) as string[])
      if (!(await prisma.employee.findFirst({ where: { nik, aktif: true } }))) fail(`NIK ${nik} tidak ditemukan / tidak aktif.`);
    await prisma.division.update({ where: { kode }, data: { kadivNik, direkturPembinaNik } });
    await audit(user, "DIVISION", kode, "UPDATE", { before: div, after: { kadivNik, direkturPembinaNik } });
    return { ok: true, message: `Divisi ${kode} tersimpan.` };
  });
}

// ---------------------------------------------------------------------------
// Matriks approval (Spec 7.1)
// ---------------------------------------------------------------------------

export async function saveApprovalRule(user: User, fd: FormData, id: number | null): Promise<AdminResult> {
  return adminOnly(user, async () => {
    const nama = str(fd, "nama").slice(0, 100);
    const jobLevels = fd.getAll("jobLevels").map(String).filter((j) => JOB_LEVELS.includes(j as never));
    const divisiKode = str(fd, "divisiKode") || null;
    const statusEmployment = str(fd, "statusEmployment") || null;
    const jenisKebutuhan = str(fd, "jenisKebutuhan") || null;
    const prioritas = Number(str(fd, "prioritas") || 0);
    const aktif = fd.get("aktif") === "on";
    if (!nama) fail("Nama aturan wajib diisi.");
    if (!jobLevels.length) fail("Pilih minimal 1 Job Level.");
    if (divisiKode && !(await prisma.division.findUnique({ where: { kode: divisiKode } }))) fail("Divisi tidak valid.");
    if (statusEmployment && !STATUS_EMPLOYMENT.includes(statusEmployment as never)) fail("Status of Employment tidak valid.");
    if (jenisKebutuhan && !JENIS_KEBUTUHAN.includes(jenisKebutuhan as never)) fail("Jenis Kebutuhan tidak valid.");
    if (!Number.isInteger(prioritas) || prioritas < 0 || prioritas > 999) fail("Prioritas aturan 0–999.");

    const approvers: { type: "ROLE" | "PERSON"; value: string }[] = [];
    for (let i = 1; i <= 3; i++) {
      const v = str(fd, `approver${i}`);
      if (!v) continue;
      if (approvers.length !== i - 1) fail(`Approver ${i} diisi tetapi approver ${i - 1} kosong.`);
      if (v.startsWith("ROLE:")) {
        const role = v.slice(5);
        if (!APPROVER_ROLES[role]) fail(`Peran approver ${i} tidak valid.`);
        approvers.push({ type: "ROLE", value: role });
      } else if (v.startsWith("PERSON:")) {
        const nik = v.slice(7);
        if (!(await prisma.employee.findFirst({ where: { nik, aktif: true } }))) fail(`Approver ${i}: NIK ${nik} tidak ditemukan.`);
        approvers.push({ type: "PERSON", value: nik });
      } else fail(`Approver ${i} tidak valid.`);
    }
    if (!approvers.length) fail("Isi minimal Approver 1.");

    const data = { nama, jobLevels, divisiKode, statusEmployment, jenisKebutuhan, prioritas, aktif, approvers };
    if (id) {
      const before = await prisma.approvalRule.findUnique({ where: { id } });
      if (!before) fail("Aturan tidak ditemukan.");
      await prisma.approvalRule.update({ where: { id }, data });
      await audit(user, "APPROVAL_RULE", String(id), "UPDATE", { before, after: data });
      return { ok: true, message: "Aturan approval tersimpan.", id: String(id) };
    }
    const created = await prisma.approvalRule.create({ data });
    await audit(user, "APPROVAL_RULE", String(created.id), "CREATE", data);
    return { ok: true, message: "Aturan approval dibuat.", id: String(created.id) };
  });
}

/** Aturan tidak dihapus permanen bila pernah dipakai PR — cukup dinonaktifkan. */
export async function deleteApprovalRule(user: User, id: number): Promise<AdminResult> {
  return adminOnly(user, async () => {
    const used = await prisma.prRequest.count({ where: { approvalRuleId: id } });
    if (used) fail(`Aturan sudah dipakai ${used} PR. Nonaktifkan saja agar riwayat tetap utuh.`);
    const before = await prisma.approvalRule.delete({ where: { id } });
    await audit(user, "APPROVAL_RULE", String(id), "DELETE", before);
    return { ok: true, message: "Aturan dihapus." };
  });
}

// ---------------------------------------------------------------------------
// Hari libur (Spec 9)
// ---------------------------------------------------------------------------

/** Tambah/ubah hari libur. Mendukung tempel banyak baris: "YYYY-MM-DD;Keterangan" atau "DD/MM/YYYY;Keterangan". */
export async function upsertHolidays(user: User, text: string): Promise<AdminResult> {
  return adminOnly(user, async () => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) fail("Isi minimal 1 baris.");
    if (lines.length > 100) fail("Maksimal 100 baris sekali simpan.");
    const rows: { tanggal: Date; keterangan: string }[] = [];
    for (const [i, line] of lines.entries()) {
      const [rawDate, ...rest] = line.split(/[;\t|]/);
      const ds = rawDate.trim();
      const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ds);
      const tanggal = parseIsoDate(dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : ds);
      const keterangan = rest.join(" ").trim().slice(0, 150);
      if (!tanggal) fail(`Baris ${i + 1}: tanggal "${ds}" tidak valid (pakai DD/MM/YYYY atau YYYY-MM-DD).`);
      if (!keterangan) fail(`Baris ${i + 1}: keterangan wajib diisi.`);
      rows.push({ tanggal: tanggal!, keterangan });
    }
    await prisma.$transaction(
      rows.map((r) => prisma.holiday.upsert({ where: { tanggal: r.tanggal }, update: { keterangan: r.keterangan }, create: r })),
    );
    await audit(user, "HOLIDAY", rows.map((r) => toIsoDate(r.tanggal)).join(","), "UPSERT", rows);
    return { ok: true, message: `${rows.length} hari libur tersimpan.` };
  });
}

export async function deleteHoliday(user: User, iso: string): Promise<AdminResult> {
  return adminOnly(user, async () => {
    const tanggal = parseIsoDate(iso) ?? fail("Tanggal tidak valid.");
    await prisma.holiday.delete({ where: { tanggal: tanggal! } });
    await audit(user, "HOLIDAY", iso, "DELETE");
    return { ok: true, message: "Hari libur dihapus." };
  });
}

// ---------------------------------------------------------------------------
// Master jurusan / sertifikasi / jabatan
// ---------------------------------------------------------------------------

export type MasterKind = "jurusan" | "sertifikasi" | "jabatan";

export async function addMaster(user: User, kind: MasterKind, nama: string, kelompok: string): Promise<AdminResult> {
  return adminOnly(user, async () => {
    nama = nama.trim().slice(0, 150);
    kelompok = kelompok.trim().slice(0, 50) || "Lainnya";
    if (!nama) fail("Nama wajib diisi.");
    if (kind === "jabatan") await prisma.masterJabatan.create({ data: { nama } });
    else if (kind === "jurusan") {
      if (!["UMUM", "SMA_SMK", "PT"].includes(kelompok)) fail("Kelompok jurusan tidak valid.");
      await prisma.masterJurusan.create({ data: { nama, kelompok, urutan: 999 } });
    } else await prisma.masterSertifikasi.create({ data: { nama, kelompok, urutan: 999 } });
    await audit(user, `MASTER_${kind.toUpperCase()}`, nama, "CREATE", { kelompok });
    return { ok: true, message: `"${nama}" ditambahkan.` };
  });
}

/** Menghapus pilihan dari daftar tidak mengubah PR lama (nilai tersimpan sebagai teks). */
export async function deleteMaster(user: User, kind: MasterKind, id: number): Promise<AdminResult> {
  return adminOnly(user, async () => {
    const before =
      kind === "jabatan"
        ? await prisma.masterJabatan.delete({ where: { id } })
        : kind === "jurusan"
          ? await prisma.masterJurusan.delete({ where: { id } })
          : await prisma.masterSertifikasi.delete({ where: { id } });
    await audit(user, `MASTER_${kind.toUpperCase()}`, before.nama, "DELETE");
    return { ok: true, message: `"${before.nama}" dihapus.` };
  });
}

// ---------------------------------------------------------------------------
// Reset password (AUTH_MODE=local) — password sementara ditampilkan SEKALI ke Admin HR
// ---------------------------------------------------------------------------

export async function resetPassword(user: User, nik: string): Promise<AdminResult & { tempPassword?: string }> {
  let temp = "";
  const r = await adminOnly(user, async () => {
    const emp = await prisma.employee.findUnique({ where: { nik } });
    if (!emp) fail("Karyawan tidak ditemukan.");
    temp = generateTempPassword();
    await prisma.employee.update({
      where: { nik },
      data: {
        passwordHash: await hashPassword(temp),
        mustChangePassword: true,
        failedLogins: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    });
    await audit(user, "EMPLOYEE", nik, "RESET_PASSWORD");
    return { ok: true, message: "Password sementara dibuat." };
  });
  return r.ok ? { ...r, tempPassword: temp } : r;
}
