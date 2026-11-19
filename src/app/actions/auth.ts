"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { authMode, createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { authenticate } from "@/lib/auth/login";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/lib/auth/password";

function safeNext(next: FormDataEntryValue | null) {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64);
}

/** Prototype: login dengan memilih akun dummy (AUTH_MODE=dummy). */
export async function loginDummy(formData: FormData) {
  if (authMode() !== "dummy") throw new Error("Login dummy dinonaktifkan.");
  const nik = String(formData.get("nik") ?? "");
  const emp = await prisma.employee.findUnique({ where: { nik } });
  if (!emp || !emp.aktif) redirect("/login?error=1");
  await createSession(emp.nik, emp.sessionVersion);
  redirect(safeNext(formData.get("next")));
}

/** Production: NIK + password (AUTH_MODE=local atau ldap). */
export async function loginPassword(_prev: { message: string } | null, formData: FormData) {
  const r = await authenticate(String(formData.get("nik") ?? ""), String(formData.get("password") ?? ""), await clientIp());
  if (!r.ok) return { message: r.message };
  await createSession(r.nik, r.sessionVersion);
  redirect(r.mustChangePassword ? "/akun/password?wajib=1" : safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/** Ganti password sendiri (AUTH_MODE=local). Semua sesi lain otomatis keluar. */
export async function changePassword(_prev: { ok: boolean; message: string } | null, fd: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (authMode() !== "local") return { ok: false, message: "Password dikelola oleh ESS/Active Directory." };
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("new") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (!user.passwordHash || !(await verifyPassword(current, user.passwordHash)))
    return { ok: false, message: "Password saat ini salah." };
  const policy = passwordPolicyError(next, user.nik);
  if (policy) return { ok: false, message: policy };
  if (next !== confirm) return { ok: false, message: "Konfirmasi password tidak sama." };
  if (await verifyPassword(next, user.passwordHash)) return { ok: false, message: "Password baru harus berbeda dari password lama." };
  const updated = await prisma.employee.update({
    where: { nik: user.nik },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false, sessionVersion: { increment: 1 } },
  });
  await prisma.auditLog.create({
    data: { entitas: "LOGIN", entitasId: user.nik, aksi: "GANTI_PASSWORD", olehNik: user.nik, olehNama: user.nama },
  });
  await createSession(user.nik, updated.sessionVersion);
  return { ok: true, message: "Password berhasil diganti." };
}
