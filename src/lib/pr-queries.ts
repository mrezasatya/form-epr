import "server-only";
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth/session";

/** Filter PR yang boleh dilihat pengguna pada daftar (Spec 11 & 13). */
export function visiblePrWhere(user: NonNullable<CurrentUser>): Prisma.PrRequestWhereInput {
  const notDraft: Prisma.PrRequestWhereInput = { statusPersetujuan: { not: "DRAFT" } };
  if (user.isRecruiter || user.isAdminHr)
    return { OR: [{ requesterNik: user.nik }, notDraft] };
  const or: Prisma.PrRequestWhereInput[] = [{ requesterNik: user.nik }];
  if (user.isKadiv) or.push({ divisiKode: user.divisiKode, ...notDraft });
  return { OR: or };
}
