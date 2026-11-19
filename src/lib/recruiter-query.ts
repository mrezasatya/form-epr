import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { parseIsoDate, todayWib } from "./dates";

/** Filter Dashboard Rekruter (Spec 10) — dipakai tabel & export Excel agar hasilnya sama. */
export type RecruiterFilters = {
  q?: string;
  divisi?: string;
  status?: string; // MENUNGGU_APPROVAL | DITOLAK | OPEN | ON_HOLD | FILLED | CANCELLED | TERLAMBAT | PERLU_DILENGKAPI | PENGAJUAN
  prioritas?: string;
  pic?: string;
  dari?: string; // tanggal pengajuan YYYY-MM-DD
  sampai?: string;
};

export function parseFilters(sp: Record<string, string | string[] | undefined>): RecruiterFilters {
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : undefined) || undefined;
  return { q: g("q"), divisi: g("divisi"), status: g("status"), prioritas: g("prioritas"), pic: g("pic"), dari: g("dari"), sampai: g("sampai") };
}

export function filtersToQuery(f: RecruiterFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return p.toString();
}

export function recruiterWhere(f: RecruiterFilters): Prisma.PrRequestWhereInput {
  const and: Prisma.PrRequestWhereInput[] = [{ statusPersetujuan: { not: "DRAFT" } }];
  if (f.q)
    and.push({
      OR: [
        { prNo: { contains: f.q, mode: "insensitive" } },
        { jobTitle: { contains: f.q, mode: "insensitive" } },
        { requesterNama: { contains: f.q, mode: "insensitive" } },
        { departemenKode: { contains: f.q, mode: "insensitive" } },
      ],
    });
  if (f.divisi) and.push({ divisiKode: f.divisi });
  if (f.prioritas) and.push({ prioritas: f.prioritas });
  if (f.pic) and.push(f.pic === "-" ? { recruiterPic: null } : { recruiterPic: f.pic });
  const dari = f.dari ? parseIsoDate(f.dari) : null;
  const sampai = f.sampai ? parseIsoDate(f.sampai) : null;
  if (dari || sampai) and.push({ tanggalPengajuan: { ...(dari && { gte: dari }), ...(sampai && { lte: sampai }) } });
  switch (f.status) {
    case "MENUNGGU_APPROVAL":
    case "DITOLAK":
      and.push({ statusPersetujuan: f.status });
      break;
    case "OPEN":
    case "ON_HOLD":
    case "FILLED":
    case "CANCELLED":
      and.push({ statusPermintaan: f.status });
      break;
    case "TERLAMBAT":
      and.push({ statusPermintaan: { in: ["OPEN", "ON_HOLD"] }, expectedDate: { lt: todayWib() } });
      break;
    case "PERLU_DILENGKAPI":
      and.push({ statusPersetujuan: "DISETUJUI", OR: [{ prioritas: null }, { recruiterPic: null }] });
      break;
    case "PENGAJUAN":
      and.push({ actionRequests: { some: { status: "MENUNGGU" } } });
      break;
  }
  return { AND: and };
}

export async function findRecruiterPrs(f: RecruiterFilters, take?: number) {
  return prisma.prRequest.findMany({
    where: recruiterWhere(f),
    include: {
      approvals: { orderBy: { level: "asc" } },
      candidates: { orderBy: { createdAt: "asc" } },
      replacedEmployees: true,
      actionRequests: { where: { status: "MENUNGGU" }, select: { id: true, jenis: true } },
    },
    orderBy: [{ tanggalPengajuan: "desc" }, { prNo: "desc" }],
    take,
  });
}
