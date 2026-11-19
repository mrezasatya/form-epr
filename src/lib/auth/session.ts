import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { DEFAULT_REQUESTER_LEVELS, ROLES } from "@/lib/constants";

const COOKIE = "epr_session";
const MAX_AGE = 60 * 60 * 10; // 10 jam (satu shift kerja)

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET belum diatur (minimal 32 karakter).");
  return new TextEncoder().encode(s);
}

export async function createSession(nik: string, sessionVersion = 0) {
  const token = await new SignJWT({ nik, sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

async function sessionClaims(): Promise<{ nik: string; sv: number } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return typeof payload.nik === "string" ? { nik: payload.nik, sv: typeof payload.sv === "number" ? payload.sv : 0 } : null;
  } catch {
    return null;
  }
}

export type CurrentUser = Awaited<ReturnType<typeof loadUser>>;

async function loadUser(nik: string, sv: number) {
  const emp = await prisma.employee.findUnique({ where: { nik }, include: { division: true } });
  // Sesi tidak berlaku bila akun nonaktif atau password sudah diganti/di-reset (sessionVersion naik).
  if (!emp || !emp.aktif || emp.sessionVersion !== sv) return null;
  const isKadiv = emp.division.kadivNik === emp.nik;
  return {
    ...emp,
    isKadiv,
    isDireksi: emp.jobLevel === "Director",
    isRecruiter: emp.roles.includes(ROLES.RECRUITER),
    isAdminHr: emp.roles.includes(ROLES.ADMIN_HR),
    canRequest: DEFAULT_REQUESTER_LEVELS.includes(emp.jobLevel) || emp.isRequesterExtra,
  };
}

export async function getCurrentUser() {
  const c = await sessionClaims();
  return c ? loadUser(c.nik, c.sv) : null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && authMode() === "local") redirect("/akun/password?wajib=1");
  return user;
}

export function authMode(): "dummy" | "local" | "ldap" {
  const m = process.env.AUTH_MODE;
  return m === "local" || m === "ldap" ? m : "dummy";
}
