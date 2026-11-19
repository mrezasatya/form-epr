"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  changeStatus,
  createActionRequest,
  deleteCandidate,
  rejectActionRequest,
  saveCandidate,
  updateRecruitment,
  type ActionResult,
} from "@/lib/recruitment-service";

async function done(r: ActionResult, prId: string) {
  if (r.ok) revalidatePath(`/pr/${prId}`);
  return r;
}

export async function updateRecruitmentAction(prId: string, fd: FormData) {
  return done(await updateRecruitment(await requireUser(), prId, fd), prId);
}
export async function saveCandidateAction(prId: string, fd: FormData) {
  return done(await saveCandidate(await requireUser(), prId, fd), prId);
}
export async function deleteCandidateAction(prId: string, candidateId: string) {
  return done(await deleteCandidate(await requireUser(), prId, candidateId), prId);
}
export async function changeStatusAction(prId: string, fd: FormData) {
  return done(await changeStatus(await requireUser(), prId, fd), prId);
}
export async function createActionRequestAction(prId: string, fd: FormData) {
  return done(await createActionRequest(await requireUser(), prId, fd), prId);
}
export async function rejectActionRequestAction(prId: string, requestId: string, catatan: string) {
  return done(await rejectActionRequest(await requireUser(), requestId, catatan), prId);
}
