/** Konfigurasi operasional yang dapat diatur lewat .env (dengan default sesuai spesifikasi). */
export function reminderBusinessDays(): number {
  const n = Number(process.env.REMINDER_BUSINESS_DAYS ?? 3); // Spec 8 / 14 #8 [KONFIRMASI]
  return Number.isInteger(n) && n > 0 ? n : 3;
}
export const MAX_SEND_ATTEMPTS = 5;
