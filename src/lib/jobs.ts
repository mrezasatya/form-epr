import "server-only";
import { prisma } from "./db";
import { businessDaysBetween, isBusinessDay, todayWib, toIsoDate } from "./dates";
import { mailMode, sendMail } from "./mail/mailer";
import { notify } from "./notify";
import { approvalWaitingSince } from "./reports";
import { MAX_SEND_ATTEMPTS, reminderBusinessDays } from "./settings";

/**
 * Pengirim email dari outbox (NotificationLog berstatus ANTRE).
 * - Klaim baris secara atomik (FOR UPDATE SKIP LOCKED) → aman walau aplikasi berjalan di >1 server.
 * - Gagal → dicoba ulang dengan jeda 5, 10, 15, 20 menit; setelah 5x berstatus GAGAL permanen.
 */
export async function processOutbox(limit = 20): Promise<{ sent: number; failed: number }> {
  if (mailMode() !== "smtp") return { sent: 0, failed: 0 };
  // Pulihkan baris yang macet di status MENGIRIM (mis. server mati saat mengirim)
  await prisma.$executeRaw`UPDATE "NotificationLog" SET "statusKirim"='ANTRE'
    WHERE "statusKirim"='MENGIRIM' AND "percobaanTerakhir" < now() - interval '10 minutes'`;
  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "NotificationLog" SET "statusKirim"='MENGIRIM', "percobaanTerakhir"=now(), "percobaan"="percobaan"+1
    WHERE id IN (
      SELECT id FROM "NotificationLog"
      WHERE "statusKirim"='ANTRE'
         OR ("statusKirim"='GAGAL' AND "percobaan" < ${MAX_SEND_ATTEMPTS}
             AND "percobaanTerakhir" < now() - ("percobaan" * interval '5 minutes'))
      ORDER BY "waktu" LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING id`;
  let sent = 0;
  let failed = 0;
  for (const { id } of claimed) {
    const n = await prisma.notificationLog.findUnique({ where: { id } });
    if (!n) continue;
    const emp = n.penerimaNik ? await prisma.employee.findUnique({ where: { nik: n.penerimaNik } }) : null;
    try {
      if (!emp?.email) {
        await prisma.notificationLog.update({
          where: { id },
          data: { statusKirim: "GAGAL", percobaan: MAX_SEND_ATTEMPTS, errorTerakhir: "Email penerima belum terdaftar di master karyawan." },
        });
        failed++;
        continue;
      }
      await sendMail(`${emp.nama} <${emp.email}>`, { subjek: n.subjek, isi: n.isi, link: n.link });
      await prisma.notificationLog.update({ where: { id }, data: { statusKirim: "TERKIRIM", terkirimPada: new Date(), errorTerakhir: null } });
      sent++;
    } catch (e) {
      failed++;
      await prisma.notificationLog.update({
        where: { id },
        data: { statusKirim: "GAGAL", errorTerakhir: String((e as Error).message ?? e).slice(0, 500) },
      });
    }
  }
  return { sent, failed };
}

/**
 * Pengingat approval yang tertunda > N hari kerja (Spec 8). Maksimal 1 email per approver per PR per hari kerja,
 * dikirim mulai pukul 08.00 WIB.
 */
export async function sendApprovalReminders(now = new Date()): Promise<number> {
  if (process.env.REMINDER_ENABLED === "false") return 0;
  const today = todayWib(now);
  const holidays = new Set((await prisma.holiday.findMany({ select: { tanggal: true } })).map((h) => toIsoDate(h.tanggal)));
  const hourWib = (now.getUTCHours() + 7) % 24;
  if (!isBusinessDay(today, holidays) || hourWib < 8) return 0;
  const n = reminderBusinessDays();

  const pending = await prisma.prApproval.findMany({
    where: { status: "PENDING", pr: { statusPersetujuan: "MENUNGGU_APPROVAL" } },
    include: { pr: { include: { approvals: { select: { level: true, tanggal: true } } } } },
  });
  let count = 0;
  for (const step of pending) {
    const pr = step.pr;
    if (!pr.tanggalPengajuan || pr.currentLevel !== step.level || !step.approverNik) continue;
    const since = approvalWaitingSince(pr.approvals, step.level, pr.tanggalPengajuan);
    const waiting = businessDaysBetween(since, today, holidays);
    if (waiting <= n) continue;
    if (step.lastReminderAt && toIsoDate(todayWib(step.lastReminderAt)) === toIsoDate(today)) continue;

    const done = await prisma.$transaction(async (tx) => {
      // Kunci baris langkah approval agar pengingat tidak terkirim ganda dari 2 server
      const locked = await tx.$queryRaw<{ lastReminderAt: Date | null }[]>`
        SELECT "lastReminderAt" FROM "PrApproval" WHERE id = ${step.id} AND status = 'PENDING' FOR UPDATE SKIP LOCKED`;
      if (!locked.length) return false;
      const last = locked[0].lastReminderAt;
      if (last && toIsoDate(todayWib(last)) === toIsoDate(today)) return false;
      const to = await tx.employee.findUnique({ where: { nik: step.approverNik! } });
      await notify(tx, {
        prId: pr.id,
        to,
        jenis: "PENGINGAT_APPROVAL",
        subjek: `[Pengingat] PR ${pr.prNo} menunggu approval Anda (${waiting} hari kerja)`,
        isi: `Yth. ${to?.nama},\n\nPR ${pr.prNo} – ${pr.jobTitle} (${pr.kebutuhan} orang) dari ${pr.requesterNama} (${pr.divisiKode}) sudah menunggu persetujuan Anda (Approval ${step.level}) selama ${waiting} hari kerja.\nMohon segera ditindaklanjuti.`,
        path: `/pr/${pr.id}`,
      });
      await tx.prApproval.update({ where: { id: step.id }, data: { lastReminderAt: now, reminderCount: { increment: 1 } } });
      return true;
    });
    if (done) count++;
  }
  return count;
}

let started = false;

/** Dijalankan sekali saat server start (lihat src/instrumentation.ts). JOBS_ENABLED=false untuk mematikan. */
export function startBackgroundJobs() {
  if (started || process.env.JOBS_ENABLED === "false") return;
  started = true;
  const safe = (name: string, fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
    } catch (e) {
      console.error(`[jobs] ${name} gagal:`, (e as Error).message);
    }
  };
  const outbox = safe("outbox", processOutbox);
  const reminders = safe("pengingat", () => sendApprovalReminders());
  setInterval(outbox, Number(process.env.OUTBOX_INTERVAL_MS ?? 30_000)).unref();
  setInterval(reminders, 15 * 60_000).unref();
  setTimeout(outbox, 5_000).unref();
  setTimeout(reminders, 60_000).unref();
  console.log(`[jobs] aktif · MAIL_MODE=${mailMode()} · pengingat > ${reminderBusinessDays()} hari kerja`);
}
