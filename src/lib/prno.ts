import type { Tx } from "./db";
import { romanMonth } from "./dates";

/** Format PR NO: NNN/SDM/PR/{BULAN ROMAWI}/{TAHUN} — Spec Bagian 6. */
export function formatPrNo(seq: number, tanggalPengajuan: Date): string {
  const nnn = String(seq).padStart(3, "0");
  return `${nnn}/SDM/PR/${romanMonth(tanggalPengajuan.getUTCMonth() + 1)}/${tanggalPengajuan.getUTCFullYear()}`;
}

/**
 * Ambil nomor urut berikutnya secara atomik (aman untuk submit bersamaan).
 * Nomor berlaku global semua divisi dan otomatis reset tiap tahun baru
 * karena counter disimpan per tahun.
 */
export async function nextPrNo(tx: Tx, tanggalPengajuan: Date): Promise<string> {
  const tahun = tanggalPengajuan.getUTCFullYear();
  const rows = await tx.$queryRaw<{ nomorTerakhir: number }[]>`
    INSERT INTO "PrCounter" ("tahun", "nomorTerakhir") VALUES (${tahun}, 1)
    ON CONFLICT ("tahun") DO UPDATE SET "nomorTerakhir" = "PrCounter"."nomorTerakhir" + 1
    RETURNING "nomorTerakhir"`;
  return formatPrNo(rows[0].nomorTerakhir, tanggalPengajuan);
}
