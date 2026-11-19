import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "./db";
import { EMPLOYEE_JOB_LEVELS } from "./constants";

/**
 * Impor master karyawan dari Excel (ekspor HRIS/ESS) — Spec 14 #2.
 * Kolom (baris 1 = judul, urutan bebas): NIK, Nama, Jabatan, Job Level, Divisi, Departemen, Email, NIK Atasan, Aktif.
 * Peran sistem (Rekruter/Admin HR/dll.) & hak pemohon tambahan TIDAK diubah oleh impor.
 */
export const IMPORT_COLUMNS = ["NIK", "Nama", "Jabatan", "Job Level", "Divisi", "Departemen", "Email", "NIK Atasan", "Aktif"] as const;
const REQUIRED = ["NIK", "Nama", "Jabatan", "Job Level", "Divisi", "Departemen"] as const;
export const MAX_IMPORT_ROWS = 10_000;

export type ImportRow = {
  baris: number;
  nik: string;
  nama: string;
  jabatan: string;
  jobLevel: string;
  divisiKode: string;
  departemenKode: string;
  email: string | null;
  atasanNik: string | null;
  aktif: boolean;
};
export type RowIssue = { baris: number; nik: string; pesan: string };
export type ImportPreview = {
  total: number;
  baru: number;
  diubah: number;
  tetap: number;
  error: RowIssue[];
  peringatan: RowIssue[];
  divisiBaru: string[];
  departemenBaru: string[];
  akanDinonaktifkan: number;
};

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text; // hyperlink
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return String(v.result ?? "");
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v);
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ");

export async function parseWorkbook(buf: ArrayBuffer): Promise<{ rows: ImportRow[]; errors: RowIssue[] } | { fatal: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    return { fatal: "File tidak bisa dibaca. Pastikan formatnya .xlsx (Excel)." };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { fatal: "File tidak memiliki sheet." };
  const header = new Map<string, number>();
  ws.getRow(1).eachCell((c, col) => header.set(norm(cellText(c.value)).toLowerCase(), col));
  const missing = REQUIRED.filter((h) => !header.has(h.toLowerCase()));
  if (missing.length) return { fatal: `Kolom wajib tidak ditemukan di baris 1: ${missing.join(", ")}.` };
  if (ws.rowCount - 1 > MAX_IMPORT_ROWS) return { fatal: `Maksimal ${MAX_IMPORT_ROWS} baris per impor.` };

  const get = (row: ExcelJS.Row, h: string) => {
    const col = header.get(h.toLowerCase());
    return col ? norm(cellText(row.getCell(col).value)) : "";
  };
  const levelMap = new Map(EMPLOYEE_JOB_LEVELS.map((l) => [l.toLowerCase(), l]));
  const rows: ImportRow[] = [];
  const errors: RowIssue[] = [];
  const seen = new Set<string>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const nik = get(row, "NIK");
    if (!nik && !get(row, "Nama")) continue; // baris kosong
    const issue = (pesan: string) => errors.push({ baris: r, nik, pesan });
    if (!/^[A-Za-z0-9._-]{3,20}$/.test(nik)) { issue("NIK tidak valid (3–20 karakter huruf/angka/titik/strip)."); continue; }
    if (seen.has(nik)) { issue("NIK ganda di file."); continue; }
    seen.add(nik);
    const jobLevel = levelMap.get(get(row, "Job Level").toLowerCase());
    if (!jobLevel) { issue(`Job Level "${get(row, "Job Level")}" tidak dikenal. Pilihan: ${EMPLOYEE_JOB_LEVELS.join(", ")}.`); continue; }
    const email = get(row, "Email") || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { issue(`Email "${email}" tidak valid.`); continue; }
    const aktifRaw = get(row, "Aktif").toLowerCase();
    const missingField = (["Nama", "Jabatan", "Divisi", "Departemen"] as const).find((h) => !get(row, h));
    if (missingField) { issue(`${missingField} kosong.`); continue; }
    rows.push({
      baris: r,
      nik,
      nama: get(row, "Nama").slice(0, 100),
      jabatan: get(row, "Jabatan").slice(0, 100),
      jobLevel,
      divisiKode: get(row, "Divisi").toUpperCase(),
      departemenKode: get(row, "Departemen").toUpperCase(),
      email,
      atasanNik: get(row, "NIK Atasan") || null,
      aktif: !["tidak", "n", "no", "false", "0", "nonaktif"].includes(aktifRaw),
    });
  }
  return { rows, errors };
}

/** Hitung dampak impor tanpa menyimpan apa pun. */
export async function previewImport(
  rows: ImportRow[],
  parseErrors: RowIssue[],
  opts: { createOrg: boolean; deactivateMissing: boolean },
): Promise<ImportPreview> {
  const [existing, depts, divisions] = await Promise.all([
    prisma.employee.findMany(),
    prisma.department.findMany(),
    prisma.division.findMany({ select: { kode: true } }),
  ]);
  const byNik = new Map(existing.map((e) => [e.nik, e]));
  const deptSet = new Set(depts.map((d) => `${d.divisiKode}|${d.kode}`));
  const divSet = new Set(divisions.map((d) => d.kode));
  const fileNiks = new Set(rows.map((r) => r.nik));
  const error = [...parseErrors];
  const peringatan: RowIssue[] = [];
  const divisiBaru = new Set<string>();
  const departemenBaru = new Set<string>();
  let baru = 0, diubah = 0, tetap = 0;

  for (const r of rows) {
    const key = `${r.divisiKode}|${r.departemenKode}`;
    if (!deptSet.has(key)) {
      if (!opts.createOrg) { error.push({ baris: r.baris, nik: r.nik, pesan: `Divisi/Departemen ${r.divisiKode}/${r.departemenKode} belum ada di master.` }); continue; }
      if (!divSet.has(r.divisiKode)) divisiBaru.add(r.divisiKode);
      departemenBaru.add(`${r.divisiKode}/${r.departemenKode}`);
    }
    if (r.atasanNik && !fileNiks.has(r.atasanNik) && !byNik.has(r.atasanNik))
      peringatan.push({ baris: r.baris, nik: r.nik, pesan: `NIK atasan ${r.atasanNik} tidak ditemukan — kolom atasan dikosongkan.` });
    if (!r.email) peringatan.push({ baris: r.baris, nik: r.nik, pesan: "Email kosong — karyawan tidak akan menerima notifikasi email." });
    const e = byNik.get(r.nik);
    if (!e) baru++;
    else if (
      e.nama !== r.nama || e.jabatan !== r.jabatan || e.jobLevel !== r.jobLevel || e.divisiKode !== r.divisiKode ||
      e.departemenKode !== r.departemenKode || (e.email ?? null) !== r.email || (e.atasanNik ?? null) !== r.atasanNik || e.aktif !== r.aktif
    ) diubah++;
    else tetap++;
  }
  const akanDinonaktifkan = opts.deactivateMissing ? existing.filter((e) => e.aktif && !fileNiks.has(e.nik)).length : 0;
  return {
    total: rows.length,
    baru,
    diubah,
    tetap,
    error: error.sort((a, b) => a.baris - b.baris),
    peringatan,
    divisiBaru: [...divisiBaru],
    departemenBaru: [...departemenBaru],
    akanDinonaktifkan,
  };
}

/** Simpan hasil impor dalam satu transaksi (semua atau tidak sama sekali). */
export async function commitImport(
  rows: ImportRow[],
  opts: { createOrg: boolean; deactivateMissing: boolean; protectNik: string },
): Promise<{ upserted: number; deactivated: number }> {
  const known = new Set((await prisma.employee.findMany({ select: { nik: true } })).map((e) => e.nik));
  const fileNiks = new Set(rows.map((r) => r.nik));
  return prisma.$transaction(
    async (tx) => {
      if (opts.createOrg) {
        for (const r of rows) {
          await tx.division.upsert({ where: { kode: r.divisiKode }, update: {}, create: { kode: r.divisiKode, nama: r.divisiKode } });
          await tx.department.upsert({
            where: { divisiKode_kode: { divisiKode: r.divisiKode, kode: r.departemenKode } },
            update: {},
            create: { divisiKode: r.divisiKode, kode: r.departemenKode },
          });
        }
      }
      // Tahap 1: data utama tanpa atasan; tahap 2: atasan (agar urutan baris di file tidak berpengaruh)
      for (const r of rows) {
        const data = { nama: r.nama, jabatan: r.jabatan, jobLevel: r.jobLevel, divisiKode: r.divisiKode, departemenKode: r.departemenKode, email: r.email, aktif: r.nik === opts.protectNik ? true : r.aktif };
        await tx.employee.upsert({ where: { nik: r.nik }, update: data, create: { nik: r.nik, ...data } });
      }
      for (const r of rows) {
        const atasan = r.atasanNik && (fileNiks.has(r.atasanNik) || known.has(r.atasanNik)) && r.atasanNik !== r.nik ? r.atasanNik : null;
        await tx.employee.update({ where: { nik: r.nik }, data: { atasanNik: atasan } });
      }
      let deactivated = 0;
      if (opts.deactivateMissing) {
        const res = await tx.employee.updateMany({
          where: { aktif: true, nik: { notIn: [...fileNiks, opts.protectNik] } },
          data: { aktif: false, sessionVersion: { increment: 1 } },
        });
        deactivated = res.count;
      }
      return { upserted: rows.length, deactivated };
    },
    { timeout: 120_000 },
  );
}

export async function buildTemplate(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Karyawan");
  ws.columns = IMPORT_COLUMNS.map((h) => ({ header: h, width: h === "Nama" || h === "Jabatan" || h === "Email" ? 28 : 16 }));
  ws.getRow(1).font = { bold: true };
  ws.addRow(["123456", "Contoh Nama", "Welder", "Operator", "PRO", "WS A", "contoh.nama@perusahaan.co.id", "300001", "Ya"]);
  const info = wb.addWorksheet("Petunjuk");
  info.columns = [{ width: 110 }];
  [
    "Isi sheet 'Karyawan' mulai baris 2. Judul kolom di baris 1 jangan diubah (urutan kolom boleh berbeda).",
    "Kolom wajib: NIK, Nama, Jabatan, Job Level, Divisi, Departemen. Kolom opsional: Email, NIK Atasan, Aktif (Ya/Tidak; kosong = Ya).",
    `Job Level harus salah satu dari: ${EMPLOYEE_JOB_LEVELS.join(", ")}.`,
    "Divisi & Departemen memakai kode yang sama dengan master e-PR (mis. PRO / WS A).",
    "Peran sistem (Rekruter, Admin HR, Kepala HRD, Direktur Utama) dan hak pemohon tambahan diatur di menu Admin HR, tidak lewat file ini.",
  ].forEach((t) => info.addRow([t]));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
