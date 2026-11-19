"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { decide, savePr, type SaveResult } from "@/lib/pr-service";
import type { PrFormInput } from "@/lib/pr-schema";

export async function saveDraftAction(input: PrFormInput, draftId?: string): Promise<SaveResult> {
  const user = await requireUser();
  const r = await savePr(user, input, "draft", draftId);
  if (r.ok) revalidatePath("/pr");
  return r;
}

export async function submitPrAction(input: PrFormInput, draftId?: string): Promise<SaveResult> {
  const user = await requireUser();
  const r = await savePr(user, input, "submit", draftId);
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function decideAction(prId: string, decision: "APPROVE" | "REJECT", catatan: string) {
  const user = await requireUser();
  const r = await decide(user, prId, decision, catatan);
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function deleteDraftAction(prId: string) {
  const user = await requireUser();
  const { prisma } = await import("@/lib/db");
  await prisma.prRequest.deleteMany({ where: { id: prId, requesterNik: user.nik, statusPersetujuan: "DRAFT" } });
  revalidatePath("/pr");
  return { ok: true as const };
}
