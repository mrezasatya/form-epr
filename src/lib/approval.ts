// Mesin matriks approval — Spec Bagian 7.
// Bagian "murni" (pemilihan aturan & penyusunan langkah) dipisah dari akses DB
// agar mudah diuji.

import { APPROVER_ROLES } from "./constants";

export type ApproverRef = { type: "ROLE" | "PERSON"; value: string };

export type RuleLike = {
  id: number;
  nama: string;
  jobLevels: string[];
  divisiKode: string | null;
  statusEmployment: string | null;
  jenisKebutuhan: string | null;
  approvers: unknown;
  prioritas: number;
  aktif: boolean;
};

export type PrCriteria = {
  jobLevel: string;
  divisiKode: string;
  statusEmployment: string;
  jenisKebutuhan: string;
};

/** Spesifisitas aturan = jumlah kondisi opsional yang diisi. Divisi diberi bobot lebih. */
function specificity(r: RuleLike): number {
  return (r.divisiKode ? 4 : 0) + (r.statusEmployment ? 2 : 0) + (r.jenisKebutuhan ? 1 : 0);
}

/** Pilih aturan yang cocok dan paling spesifik. */
export function selectRule<T extends RuleLike>(rules: T[], pr: PrCriteria): T | null {
  const matches = rules.filter(
    (r) =>
      r.aktif &&
      r.jobLevels.includes(pr.jobLevel) &&
      (!r.divisiKode || r.divisiKode === pr.divisiKode) &&
      (!r.statusEmployment || r.statusEmployment === pr.statusEmployment) &&
      (!r.jenisKebutuhan || r.jenisKebutuhan === pr.jenisKebutuhan),
  );
  matches.sort((a, b) => specificity(b) - specificity(a) || b.prioritas - a.prioritas || a.id - b.id);
  return matches[0] ?? null;
}

export function parseApprovers(json: unknown): ApproverRef[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter(
      (a): a is ApproverRef =>
        !!a && typeof a === "object" && (a.type === "ROLE" || a.type === "PERSON") && typeof a.value === "string",
    )
    .slice(0, 3);
}

export function approverLabel(ref: ApproverRef): string {
  return ref.type === "ROLE" ? (APPROVER_ROLES[ref.value] ?? ref.value) : "Approver khusus";
}

export type ResolvedApprover = {
  level: number;
  nik: string | null;
  nama: string;
  peran: string;
};

export type PlannedStep = ResolvedApprover & {
  status: "MENUNGGU" | "PENDING" | "DILEWATI";
  catatan: string | null;
};

/**
 * Susun langkah approval:
 * - Approver yang sama dengan pemohon → DILEWATI (Spec 7.1).
 * - Approver yang sama dengan approver level sebelumnya → DILEWATI
 *   (mis. Kadiv HRD sekaligus Kepala HRD) agar tidak menyetujui dua kali.
 * - Langkah pertama yang tidak dilewati → PENDING.
 * Mengembalikan juga apakah PR langsung disetujui (semua langkah dilewati).
 */
export function planSteps(
  approvers: ResolvedApprover[],
  requesterNik: string,
): { steps: PlannedStep[]; firstPendingLevel: number | null } {
  const seen = new Set<string>();
  let firstPendingLevel: number | null = null;
  const steps: PlannedStep[] = approvers.map((a) => {
    let status: PlannedStep["status"] = "MENUNGGU";
    let catatan: string | null = null;
    if (a.nik && a.nik === requesterNik) {
      status = "DILEWATI";
      catatan = "Dilewati otomatis: approver adalah pemohon";
    } else if (a.nik && seen.has(a.nik)) {
      status = "DILEWATI";
      catatan = "Dilewati otomatis: approver sama dengan level sebelumnya";
    } else if (firstPendingLevel === null) {
      status = "PENDING";
      firstPendingLevel = a.level;
    }
    if (a.nik) seen.add(a.nik);
    return { ...a, status, catatan };
  });
  return { steps, firstPendingLevel };
}
