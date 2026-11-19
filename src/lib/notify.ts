import "server-only";
import type { Employee } from "@prisma/client";
import type { Tx } from "./db";

/**
 * Notifikasi email (Spec Bagian 8).
 * - MAIL_MODE=log  : email hanya dicatat di tabel NotificationLog (prototype; tampil di menu Notifikasi).
 * - MAIL_MODE=smtp : baris berstatus ANTRE dikirim oleh worker (src/lib/jobs.ts) via SMTP perusahaan.
 *   Pola "outbox" ini menjamin email tidak terkirim bila transaksi gagal, dan dicoba ulang bila SMTP down.
 */
export async function notify(
  tx: Tx,
  n: { prId?: string; to: Employee | null; jenis: string; subjek: string; isi: string; path?: string },
) {
  if (!n.to) return;
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  await tx.notificationLog.create({
    data: {
      prId: n.prId,
      penerimaNik: n.to.nik,
      penerima: n.to.email ? `${n.to.nama} <${n.to.email}>` : n.to.nama,
      jenis: n.jenis,
      subjek: n.subjek,
      isi: n.isi,
      link: n.path ? `${base}${n.path}` : null,
      statusKirim: process.env.MAIL_MODE === "smtp" ? "ANTRE" : "SIMULASI",
    },
  });
}
