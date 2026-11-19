// Skema validasi Form e-PR (dipakai di browser untuk validasi inline
// DAN di server sebagai validasi final). Spec Bagian 5.1.

import { z } from "zod";
import {
  DURATION_CONTRACT,
  JENIS_KEBUTUHAN,
  JOB_LEVELS,
  LEVEL_PENDIDIKAN,
  LIMITS,
  LOKASI_KERJA,
  PENGALAMAN,
  STATUS_EMPLOYMENT,
} from "./constants";

export type PrFormInput = {
  departemenKode: string;
  jobTitle: string;
  jobLevel: string;
  jobResponsibilities: string;
  lokasiKerja: string;
  levelPendidikan: string;
  jurusan: string[];
  pengalaman: string;
  hardSkills: string[];
  softSkills: string[];
  sertifikasiWajib: "" | "Ya" | "Tidak";
  sertifikasi: string[];
  statusEmployment: string;
  durationContract: string;
  durationOthers: string;
  kebutuhan: string;
  jenisKebutuhan: string;
  replaced: { nik: string | null; nama: string }[];
  expectedDate: string; // YYYY-MM-DD
  expectedDateManual: boolean;
  remarks: string;
};

export const emptyPrForm = (departemenKode = ""): PrFormInput => ({
  departemenKode,
  jobTitle: "",
  jobLevel: "",
  jobResponsibilities: "",
  lokasiKerja: "",
  levelPendidikan: "",
  jurusan: [],
  pengalaman: "",
  hardSkills: [],
  softSkills: [],
  sertifikasiWajib: "",
  sertifikasi: [],
  statusEmployment: "",
  durationContract: "",
  durationOthers: "",
  kebutuhan: "1",
  jenisKebutuhan: "",
  replaced: [],
  expectedDate: "",
  expectedDateManual: false,
  remarks: "",
});

const req = (label: string) => z.string().trim().min(1, `${label} wajib diisi`);
const oneOf = (label: string, opts: readonly string[]) =>
  z.string().refine((v) => opts.includes(v), `Pilih ${label}`);
const list = (label: string) =>
  z.array(z.string().trim().min(1)).min(1, `${label} wajib diisi minimal 1`).max(30, "Terlalu banyak isian");

export function buildPrSchema(opts: { todayIso: string }) {
  return z
    .object({
      departemenKode: req("Departemen"),
      jobTitle: req("Job Title").max(LIMITS.jobTitle, `Maksimal ${LIMITS.jobTitle} karakter`),
      jobLevel: oneOf("Job Level", JOB_LEVELS),
      jobResponsibilities: req("Job Responsibilities").max(
        LIMITS.jobResponsibilities,
        `Maksimal ${LIMITS.jobResponsibilities} karakter`,
      ),
      lokasiKerja: oneOf("Lokasi Kerja", LOKASI_KERJA),
      levelPendidikan: oneOf("Level Pendidikan", LEVEL_PENDIDIKAN),
      jurusan: list("Jurusan"),
      pengalaman: oneOf("Pengalaman", PENGALAMAN),
      hardSkills: list("Hard Skill"),
      softSkills: list("Soft Skill"),
      sertifikasiWajib: z.enum(["Ya", "Tidak"], { errorMap: () => ({ message: "Pilih Ya atau Tidak" }) }),
      sertifikasi: z.array(z.string().trim().min(1)).max(20),
      statusEmployment: oneOf("Status of Employment", STATUS_EMPLOYMENT),
      durationContract: oneOf("Duration of Contract", DURATION_CONTRACT),
      durationOthers: z.string().trim().max(50, "Maksimal 50 karakter"),
      kebutuhan: z
        .string()
        .regex(/^\d+$/, "Isi dengan angka bulat")
        .refine((v) => Number(v) >= 1 && Number(v) <= 99, "Kebutuhan 1–99 orang"),
      jenisKebutuhan: oneOf("Jenis Kebutuhan", JENIS_KEBUTUHAN),
      replaced: z.array(z.object({ nik: z.string().nullable(), nama: z.string().trim().min(1).max(100) })),
      expectedDate: z.string(),
      expectedDateManual: z.boolean(),
      remarks: z.string().max(LIMITS.remarks, `Maksimal ${LIMITS.remarks} karakter`),
    })
    .superRefine((v, ctx) => {
      if (v.sertifikasiWajib === "Ya" && v.sertifikasi.length === 0)
        ctx.addIssue({ code: "custom", path: ["sertifikasi"], message: "Isi minimal 1 nama sertifikat" });
      if (v.durationContract === "Others" && !v.durationOthers)
        ctx.addIssue({ code: "custom", path: ["durationOthers"], message: "Jelaskan durasi kontrak" });
      if (v.jenisKebutuhan === "Replacement") {
        if (v.replaced.length === 0)
          ctx.addIssue({ code: "custom", path: ["replaced"], message: "Isi nama karyawan yang digantikan" });
        else if (/^\d+$/.test(v.kebutuhan) && v.replaced.length > Number(v.kebutuhan))
          ctx.addIssue({
            code: "custom",
            path: ["replaced"],
            message: "Jumlah nama yang digantikan melebihi jumlah Kebutuhan",
          });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.expectedDate))
        ctx.addIssue({ code: "custom", path: ["expectedDate"], message: "Tanggal tidak valid" });
      else if (v.expectedDate < opts.todayIso)
        ctx.addIssue({
          code: "custom",
          path: ["expectedDate"],
          message: "Expected Date tidak boleh sebelum Tanggal Pengajuan",
        });
    });
}

export type FieldErrors = Partial<Record<keyof PrFormInput, string>>;

export function validatePrForm(input: PrFormInput, todayIso: string): FieldErrors {
  const r = buildPrSchema({ todayIso }).safeParse(input);
  if (r.success) return {};
  const errors: FieldErrors = {};
  for (const issue of r.error.issues) {
    const key = issue.path[0] as keyof PrFormInput;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
