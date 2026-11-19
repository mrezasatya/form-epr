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

/** Input approval kertas oleh rekruter (Spec 7.4) — dengan scan opsional. */
export async function paperDecisionAction(prId: string, fd: FormData) {
  const user = await requireUser();
  const { parseIsoDate } = await import("@/lib/dates");
  const { saveMemo } = await import("@/lib/storage");
  const decision = fd.get("keputusan") === "REJECT" ? "REJECT" : "APPROVE";
  const signerName = String(fd.get("signerName") ?? "").trim().slice(0, 100);
  const signedDate = parseIsoDate(String(fd.get("signedDate") ?? ""));
  if (!user.isRecruiter) return { ok: false as const, message: "Hanya rekruter yang dapat menginput approval kertas." };
  if (!signerName) return { ok: false as const, message: "Nama penandatangan wajib diisi." };
  if (!signedDate) return { ok: false as const, message: "Tanggal tanda tangan wajib diisi." };
  const scan = await saveMemo(prId, (fd.get("scan") as File | null) ?? null);
  if (scan && !scan.ok) return { ok: false as const, message: scan.message };
  const r = await decide(user, prId, decision, String(fd.get("catatan") ?? ""), {
    signerName,
    signedDate,
    scanFile: scan?.ok ? scan.key : null,
  });
  if (r.ok) revalidatePath("/", "layout");
  return r;
}
