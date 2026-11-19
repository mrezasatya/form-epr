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
