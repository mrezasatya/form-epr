// Daftar pilihan (dropdown) — Spec Bagian 5.1 & Lampiran D.

export const JOB_LEVELS = [
  "Clerical",
  "Operator",
  "Technician",
  "Team Leader",
  "Office Staff",
  "Section Head",
  "Department Head",
  "Division Head",
] as const;

/** Job level karyawan (master) — termasuk Direksi yang tidak ada di dropdown form. */
export const EMPLOYEE_JOB_LEVELS = [...JOB_LEVELS, "Director"] as const;

/** Job level yang otomatis berhak menjadi pemohon (Spec Bagian 3). */
export const DEFAULT_REQUESTER_LEVELS = ["Department Head", "Division Head", "Director"];

export const LOKASI_KERJA = ["Head Office", "Workshop", "Site Project"] as const;
export const LEVEL_PENDIDIKAN = ["SMA/SMK", "D1", "D3", "D4/S1", "S2", "S3"] as const;
export const PENGALAMAN = ["0 tahun (Fresh Graduate)", "1-2 tahun", "3-5 tahun", ">5 tahun"] as const;
export const STATUS_EMPLOYMENT = ["Contract", "Project", "Subcont", "Paid Internship"] as const;
export const DURATION_CONTRACT = ["3 months", "6 months", "12 months", "Others"] as const;
export const JENIS_KEBUTUHAN = ["Replacement", "Additional", "Mutation"] as const;

export const SEMUA_JURUSAN = "Semua jurusan";

export const STATUS_PERMINTAAN = ["Open", "On Hold", "Cancelled", "Filled"] as const;
export const TAHAP_DETAIL = [
  "Sourcing",
  "Screening CV",
  "Interview HR",
  "Interview User",
  "Tes/Assessment",
  "Offer",
  "Negosiasi",
  "Onboarding",
  "Closed",
] as const;
export const PRIORITAS = ["High", "Medium", "Low"] as const;
export const RECRUITER_PIC = ["Adnan", "Acha", "Ami"] as const;
export const SUMBER_KANDIDAT = [
  "Internal Referral",
  "Job Portal",
  "LinkedIn",
  "Headhunter",
  "Campus",
  "Database",
  "Lainnya",
] as const;
export const STATUS_KANDIDAT = ["Offer Accepted", "Joined", "Batal"] as const;

/** Pemetaan Tahap detail (rekruter) → ringkas (user). Spec 10.1 */
export function tahapRingkas(detail: string | null | undefined): string {
  switch (detail) {
    case "Sourcing":
    case "Screening CV":
      return "Sourcing";
    case "Interview HR":
    case "Interview User":
    case "Tes/Assessment":
      return "Interview";
    case "Offer":
    case "Negosiasi":
      return "Offer";
    case "Onboarding":
      return "Onboarding";
    case "Closed":
      return "Selesai";
    default:
      return "Menunggu";
  }
}

/** Batas karakter field form. */
export const LIMITS = {
  jobTitle: 100,
  jobResponsibilities: 500,
  remarks: 250,
} as const;

/** Hari kerja default untuk Expected Date & Target Start Date (Spec Bagian 9). */
export const DEFAULT_LEAD_BUSINESS_DAYS = 45;

/** Peran sistem. */
export const ROLES = {
  ADMIN_HR: "ADMIN_HR",
  RECRUITER: "RECRUITER",
  KEPALA_HRD: "KEPALA_HRD",
  DIREKTUR_UTAMA: "DIREKTUR_UTAMA",
} as const;

/** Tipe approver relatif pada matriks approval (Spec 7.1). */
export const APPROVER_ROLES: Record<string, string> = {
  KADIV_PEMOHON: "Kadiv divisi pemohon",
  KEPALA_HRD: "Kepala HRD",
  DIREKTUR_PEMBINA: "Direktur pembina divisi",
  DIREKTUR_UTAMA: "Direktur Utama",
};
