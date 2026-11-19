"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  addMaster,
  deleteApprovalRule,
  deleteHoliday,
  deleteMaster,
  saveApprovalRule,
  saveDivision,
  saveEmployee,
  upsertHolidays,
  resetPassword,
  type AdminResult,
  type MasterKind,
} from "@/lib/admin-service";
import { previewApproval } from "@/lib/pr-service";

function done(r: AdminResult) {
  if (r.ok) revalidatePath("/admin", "layout");
  return r;
}

export async function saveEmployeeAction(isNew: boolean, fd: FormData) {
  return done(await saveEmployee(await requireUser(), fd, isNew));
}
export async function saveDivisionAction(fd: FormData) {
  return done(await saveDivision(await requireUser(), fd));
}
export async function saveApprovalRuleAction(id: number | null, fd: FormData) {
  return done(await saveApprovalRule(await requireUser(), fd, id));
}
export async function deleteApprovalRuleAction(id: number) {
  return done(await deleteApprovalRule(await requireUser(), id));
}
export async function upsertHolidaysAction(fd: FormData) {
  return done(await upsertHolidays(await requireUser(), String(fd.get("baris") ?? "")));
}
export async function deleteHolidayAction(iso: string) {
  return done(await deleteHoliday(await requireUser(), iso));
}
export async function addMasterAction(kind: MasterKind, fd: FormData) {
  return done(await addMaster(await requireUser(), kind, String(fd.get("nama") ?? ""), String(fd.get("kelompok") ?? "")));
}
export async function deleteMasterAction(kind: MasterKind, id: number) {
  return done(await deleteMaster(await requireUser(), kind, id));
}

/** Simulator matriks approval (read-only). */
export async function previewApprovalAction(fd: FormData) {
  const user = await requireUser();
  if (!user.isAdminHr) return { ok: false as const, message: "Hanya Admin HR." };
  const g = (k: string) => String(fd.get(k) ?? "");
  return previewApproval({
    jobLevel: g("jobLevel"),
    divisiKode: g("divisiKode"),
    statusEmployment: g("statusEmployment"),
    jenisKebutuhan: g("jenisKebutuhan"),
    requesterNik: g("requesterNik"),
  });
}

export async function resetPasswordAction(nik: string) {
  return resetPassword(await requireUser(), nik);
}

// ---------------- Fase 4: impor karyawan, email, sistem ----------------

export async function importEmployeesAction(fd: FormData) {
  const user = await requireUser();
  if (!user.isAdminHr) return { ok: false as const, message: "Hanya Admin HR." };
  const { parseWorkbook, previewImport, commitImport } = await import("@/lib/employee-import");
  const { prisma } = await import("@/lib/db");
  const file = fd.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false as const, message: "Pilih file Excel (.xlsx)." };
  if (file.size > 5 * 1024 * 1024) return { ok: false as const, message: "Ukuran file maksimal 5 MB." };
  const opts = { createOrg: fd.get("createOrg") === "on", deactivateMissing: fd.get("deactivateMissing") === "on" };
  const parsed = await parseWorkbook(await file.arrayBuffer());
  if ("fatal" in parsed) return { ok: false as const, message: parsed.fatal };
  const preview = await previewImport(parsed.rows, parsed.errors, opts);
  if (fd.get("commit") !== "1") return { ok: true as const, committed: false, preview };
  if (preview.error.length) return { ok: false as const, message: "Masih ada baris error. Perbaiki file lalu unggah ulang.", preview };
  const r = await commitImport(parsed.rows, { ...opts, protectNik: user.nik });
  await prisma.auditLog.create({
    data: {
      entitas: "EMPLOYEE",
      entitasId: "IMPOR",
      aksi: "IMPORT",
      data: { file: file.name, ...opts, baru: preview.baru, diubah: preview.diubah, dinonaktifkan: r.deactivated },
      olehNik: user.nik,
      olehNama: user.nama,
    },
  });
  revalidatePath("/admin", "layout");
  return { ok: true as const, committed: true, preview, result: r };
}

export async function sendTestEmailAction(fd: FormData) {
  const user = await requireUser();
  if (!user.isAdminHr) return { ok: false as const, message: "Hanya Admin HR." };
  const to = String(fd.get("to") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false as const, message: "Alamat email tidak valid." };
  const { mailMode, sendMail } = await import("@/lib/mail/mailer");
  if (mailMode() !== "smtp") return { ok: false as const, message: "MAIL_MODE masih 'log'. Ubah ke 'smtp' di .env lalu restart aplikasi." };
  try {
    await sendMail(to, {
      subjek: "Email uji e-PR",
      isi: `Email ini dikirim oleh ${user.nama} dari menu Admin HR → Sistem untuk menguji koneksi SMTP.`,
      link: process.env.APP_URL ?? null,
    });
    return { ok: true as const, message: `Email uji terkirim ke ${to}. Periksa inbox (dan folder spam).` };
  } catch (e) {
    return { ok: false as const, message: `Gagal mengirim: ${(e as Error).message}` };
  }
}

export async function retryFailedEmailsAction() {
  const user = await requireUser();
  if (!user.isAdminHr) return { ok: false as const, message: "Hanya Admin HR." };
  const { prisma } = await import("@/lib/db");
  const r = await prisma.notificationLog.updateMany({
    where: { statusKirim: "GAGAL" },
    data: { statusKirim: "ANTRE", percobaan: 0, errorTerakhir: null },
  });
  revalidatePath("/admin/sistem");
  return { ok: true as const, message: `${r.count} email dimasukkan kembali ke antrean.` };
}
