"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { authMode, createSession, destroySession } from "@/lib/auth/session";

function safeNext(next: FormDataEntryValue | null) {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

/** Prototype: login dengan memilih akun dummy (AUTH_MODE=dummy). */
export async function loginDummy(formData: FormData) {
  if (authMode() !== "dummy") throw new Error("Login dummy dinonaktifkan.");
  const nik = String(formData.get("nik") ?? "");
  const emp = await prisma.employee.findUnique({ where: { nik } });
  if (!emp || !emp.aktif) redirect("/login?error=1");
  await createSession(emp.nik);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
