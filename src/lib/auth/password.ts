import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

// bcryptjs = implementasi JavaScript murni (tanpa kompilasi native) → mudah dipasang di server mana pun.
const COST = 12;

export const hashPassword = (pw: string) => bcrypt.hash(pw, COST);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

/** Hash pembanding untuk menyamakan waktu respons saat NIK tidak ada (mencegah enumerasi NIK). */
let dummyHash: string | null = null;
export function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync("epr-dummy-password-0", COST);
  return dummyHash;
}

/** Kebijakan password: ≥ 8 karakter, ada huruf & angka, tidak sama dengan NIK. */
export function passwordPolicyError(pw: string, nik: string): string | null {
  if (pw.length < 8) return "Password minimal 8 karakter.";
  if (pw.length > 72) return "Password maksimal 72 karakter.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password harus mengandung huruf dan angka.";
  if (pw.toLowerCase().includes(nik.toLowerCase())) return "Password tidak boleh memuat NIK.";
  return null;
}

/** Password sementara yang mudah dibaca/diketik (tanpa karakter mirip: 0/O, 1/l/I). */
export function generateTempPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pick = (s: string) => s[randomInt(s.length)];
  const chars = [...Array(8)].map(() => pick(letters)).concat([...Array(3)].map(() => pick(digits)));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
