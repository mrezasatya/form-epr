import "server-only";
import { prisma } from "@/lib/db";
import { authMode } from "./session";
import { getDummyHash, verifyPassword } from "./password";
import { ldapAuthenticate } from "./ldap";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
const NIK_RE = /^[A-Za-z0-9._-]{3,20}$/;

export type LoginResult =
  | { ok: true; nik: string; sessionVersion: number; mustChangePassword: boolean }
  | { ok: false; message: string };

const GENERIC = "NIK atau password salah.";

async function log(nik: string, aksi: string, data?: object) {
  await prisma.auditLog.create({
    data: { entitas: "LOGIN", entitasId: nik.slice(0, 20), aksi, data: data ?? {}, olehNik: nik.slice(0, 20), olehNama: "-" },
  });
}

/** Verifikasi NIK + password sesuai AUTH_MODE, dengan penguncian akun setelah 5x gagal. */
export async function authenticate(nikRaw: string, password: string, ip: string): Promise<LoginResult> {
  const nik = nikRaw.trim();
  const mode = authMode();
  if (mode === "dummy") return { ok: false, message: "Mode login dummy tidak memakai password." };
  if (!NIK_RE.test(nik) || !password) {
    await verifyPassword("x", getDummyHash());
    return { ok: false, message: GENERIC };
  }

  const emp = await prisma.employee.findUnique({ where: { nik } });
  if (emp?.lockedUntil && emp.lockedUntil > new Date()) {
    const menit = Math.ceil((emp.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, message: `Akun terkunci karena terlalu banyak percobaan gagal. Coba lagi dalam ${menit} menit atau hubungi Admin HR.` };
  }

  let valid = false;
  let systemError: string | undefined;
  if (mode === "local") {
    valid = await verifyPassword(password, emp?.passwordHash ?? getDummyHash());
    if (emp && !emp.passwordHash) valid = false;
  } else {
    const r = await ldapAuthenticate(nik, password);
    valid = r.ok;
    if (!r.ok && r.reason === "error") systemError = r.detail;
  }

  if (systemError) {
    console.error(`[auth] LDAP error untuk NIK ${nik}: ${systemError}`);
    await log(nik, "LOGIN_ERROR", { ip, error: systemError.slice(0, 300) });
    return { ok: false, message: "Server login (ESS) tidak dapat dihubungi. Coba lagi beberapa saat atau hubungi IT." };
  }

  if (!valid || !emp || !emp.aktif) {
    if (emp && !valid) {
      const failed = emp.failedLogins + 1;
      await prisma.employee.update({
        where: { nik },
        data: {
          failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        },
      });
      if (failed >= MAX_FAILED_LOGINS) await log(nik, "LOCKED", { ip });
    }
    await log(nik, "LOGIN_GAGAL", { ip, alasan: !emp ? "nik_tidak_terdaftar" : !emp.aktif ? "nonaktif" : "password" });
    if (valid && emp && !emp.aktif) return { ok: false, message: "Akun Anda tidak aktif di e-PR. Hubungi Admin HR." };
    if (valid && !emp) return { ok: false, message: "NIK Anda belum terdaftar di e-PR. Hubungi Admin HR." };
    return { ok: false, message: GENERIC };
  }

  await prisma.employee.update({ where: { nik }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await log(nik, "LOGIN_OK", { ip, mode });
  return {
    ok: true,
    nik,
    sessionVersion: emp.sessionVersion,
    mustChangePassword: mode === "local" && emp.mustChangePassword,
  };
}
