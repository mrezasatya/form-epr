// Uji integrasi: worker outbox → SMTP (server SMTP lokal) & pengingat approval. Butuh DB dev berisi seed.
//   INTEGRATION=1 npx vitest run
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/db";

const PORT = 2526;
const received: { to: string; subject: string; html: string; text: string }[] = [];
let server: SMTPServer;
const created: string[] = [];

beforeAll(async () => {
  process.env.MAIL_MODE = "smtp";
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(PORT);
  process.env.SMTP_FROM = "e-PR <epr@contoh.local>";
  process.env.SMTP_TLS_REJECT_UNAUTHORIZED = "false";
  server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, _s, cb) {
      simpleParser(stream).then((m) => {
        received.push({ to: m.to ? (Array.isArray(m.to) ? m.to[0].text : m.to.text) : "", subject: m.subject ?? "", html: String(m.html), text: m.text ?? "" });
        cb();
      });
    },
  });
  await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", r));
});

afterAll(async () => {
  await prisma.notificationLog.deleteMany({ where: { id: { in: created } } });
  await new Promise<void>((r) => server.close(() => r()));
  await prisma.$disconnect();
});

describe("outbox SMTP", () => {
  it("mengirim email ANTRE dan menandai TERKIRIM", async () => {
    const { processOutbox } = await import("@/lib/jobs");
    await prisma.notificationLog.updateMany({ where: { statusKirim: { in: ["ANTRE", "GAGAL"] } }, data: { statusKirim: "SIMULASI" } });
    const n = await prisma.notificationLog.create({
      data: { penerimaNik: "300001", penerima: "Rudi", jenis: "UJI", subjek: "Uji outbox <PR>", isi: "Baris 1\nBaris 2", link: "http://localhost:3000/pr/x", statusKirim: "ANTRE" },
    });
    created.push(n.id);
    const r = await processOutbox();
    expect(r).toEqual({ sent: 1, failed: 0 });
    const after = await prisma.notificationLog.findUniqueOrThrow({ where: { id: n.id } });
    expect(after.statusKirim).toBe("TERKIRIM");
    expect(after.terkirimPada).not.toBeNull();
    const mail = received.find((m) => m.subject === "Uji outbox <PR>")!;
    expect(mail.to).toContain("rudi.300001@contoh.local");
    expect(mail.html).toContain("Baris 1<br>Baris 2");
    expect(mail.html).toContain("http://localhost:3000/pr/x");
  });

  it("penerima tanpa email → GAGAL permanen (tidak dicoba ulang)", async () => {
    const { processOutbox } = await import("@/lib/jobs");
    const n = await prisma.notificationLog.create({
      data: { penerimaNik: "TIDAK-ADA", penerima: "X", jenis: "UJI", subjek: "tanpa email", isi: "-", statusKirim: "ANTRE" },
    });
    created.push(n.id);
    await processOutbox();
    const after = await prisma.notificationLog.findUniqueOrThrow({ where: { id: n.id } });
    expect(after.statusKirim).toBe("GAGAL");
    expect(after.percobaan).toBe(5);
    expect(after.errorTerakhir).toMatch(/Email penerima/);
  });

  it("SMTP mati → GAGAL dengan pesan error, dicoba ulang nanti", async () => {
    const { processOutbox } = await import("@/lib/jobs");
    process.env.SMTP_PORT = "2599"; // tidak ada server
    const mailer = await import("@/lib/mail/mailer");
    // paksa transporter baru dengan port mati
    (mailer as unknown as { __reset?: () => void }).__reset?.();
    const n = await prisma.notificationLog.create({
      data: { penerimaNik: "300001", penerima: "Rudi", jenis: "UJI", subjek: "smtp mati", isi: "-", statusKirim: "ANTRE" },
    });
    created.push(n.id);
    await processOutbox();
    const after = await prisma.notificationLog.findUniqueOrThrow({ where: { id: n.id } });
    expect(after.statusKirim).toBe("GAGAL");
    expect(after.percobaan).toBe(1);
    expect(after.errorTerakhir).toMatch(/ECONNREFUSED|connect/i);
    process.env.SMTP_PORT = String(PORT);
    (mailer as unknown as { __reset?: () => void }).__reset?.();
  });
});

describe("pengingat approval tertunda", () => {
  it("membuat 1 pengingat per hari kerja untuk approval > 3 hari kerja", async () => {
    const { sendApprovalReminders } = await import("@/lib/jobs");
    const pending = await prisma.prApproval.findFirst({
      where: { status: "PENDING", pr: { statusPersetujuan: "MENUNGGU_APPROVAL" } },
      include: { pr: true },
    });
    expect(pending, "butuh minimal 1 PR menunggu approval di DB dev").not.toBeNull();
    await prisma.prApproval.update({ where: { id: pending!.id }, data: { lastReminderAt: null, reminderCount: 0 } });
    // Jumat 27/11/2026 10:00 WIB → menunggu sejak 19/11 = 6 hari kerja
    const now = new Date("2026-11-27T03:00:00Z");
    const first = await sendApprovalReminders(now);
    const second = await sendApprovalReminders(new Date("2026-11-27T05:00:00Z"));
    const weekend = await sendApprovalReminders(new Date("2026-11-28T03:00:00Z")); // Sabtu
    expect(first).toBeGreaterThanOrEqual(1);
    expect(second).toBe(0);
    expect(weekend).toBe(0);
    const logs = await prisma.notificationLog.findMany({ where: { jenis: "PENGINGAT_APPROVAL", prId: pending!.prId } });
    created.push(...logs.map((l) => l.id));
    expect(logs.length).toBe(1);
    expect(logs[0].subjek).toMatch(/6 hari kerja/);
    expect(logs[0].statusKirim).toBe("ANTRE");
    await prisma.prApproval.updateMany({ where: { status: "PENDING" }, data: { lastReminderAt: null, reminderCount: 0 } });
  });
});
