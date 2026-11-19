// Utilitas tanggal. Semua tanggal bisnis disimpan sebagai DATE (tanpa jam) dan
// direpresentasikan di kode sebagai objek Date pada pukul 00:00 UTC.
// "Hari ini" selalu dihitung menurut zona waktu WIB (Asia/Jakarta).

export const TZ = "Asia/Jakarta";

/** Tanggal hari ini (WIB) sebagai Date UTC tengah malam. */
export function todayWib(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
  return new Date(`${parts}T00:00:00Z`);
}

/** "YYYY-MM-DD" → Date UTC tengah malam. */
export function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "YYYY-MM-DD" (komponen UTC). */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Tanggal bisnis → "DD/MM/YYYY". */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

/** Timestamp → "DD/MM/YYYY HH:mm" WIB. */
export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}/${g("month")}/${g("year")} ${g("hour")}:${g("minute")}`;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Hari kerja = Senin–Jumat dan bukan hari libur (Spec Bagian 9). */
export function isBusinessDay(d: Date, holidays: Set<string>): boolean {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !holidays.has(toIsoDate(d));
}

/** Tambah n hari kerja. Tanggal awal tidak dihitung. */
export function addBusinessDays(start: Date, n: number, holidays: Set<string>): Date {
  let d = start;
  let added = 0;
  while (added < n) {
    d = addDays(d, 1);
    if (isBusinessDay(d, holidays)) added++;
  }
  return d;
}

/** Jumlah hari kerja di antara dua tanggal (start eksklusif, end inklusif). */
export function businessDaysBetween(start: Date, end: Date, holidays: Set<string>): number {
  let count = 0;
  let d = start;
  while (d < end) {
    d = addDays(d, 1);
    if (isBusinessDay(d, holidays)) count++;
  }
  return count;
}

/** Selisih hari kalender (end − start). */
export function calendarDaysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export function romanMonth(month1to12: number): string {
  return ROMAN[month1to12 - 1];
}
