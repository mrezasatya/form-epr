import { access, constants } from "node:fs/promises";
import path from "node:path";
import { requireUser, authMode } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ldapConfigured } from "@/lib/auth/ldap";
import { mailMode, smtpSummary } from "@/lib/mail/mailer";
import { reminderBusinessDays } from "@/lib/settings";
import { fmtDateTime, todayWib } from "@/lib/dates";
import { RetryFailedForm, TestEmailForm } from "@/components/admin/SystemActions";

export const metadata = { title: "Sistem · Admin HR" };

type Check = { label: string; ok: boolean; detail: string; warnOnly?: boolean };

export default async function SystemPage({ searchParams }: { searchParams: Promise<{ entitas?: string }> }) {
  const user = await requireUser();
  const { entitas } = await searchParams;
  const year = todayWib().getUTCFullYear();
  const storageDir = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "uploads"));
  const storageOk = await access(storageDir, constants.W_OK).then(() => true, () => false);
  const [outbox, failed, holidaysThis, holidaysNext, divMissing, rulesActive, noEmail, admins, logs, entitasList] = await Promise.all([
    prisma.notificationLog.groupBy({ by: ["statusKirim"], _count: true }),
    prisma.notificationLog.findMany({ where: { statusKirim: "GAGAL" }, orderBy: { waktu: "desc" }, take: 20 }),
    prisma.holiday.count({ where: { tanggal: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } } }),
    prisma.holiday.count({ where: { tanggal: { gte: new Date(Date.UTC(year + 1, 0, 1)), lte: new Date(Date.UTC(year + 1, 11, 31)) } } }),
    prisma.division.count({ where: { OR: [{ kadivNik: null }, { direkturPembinaNik: null }] } }),
    prisma.approvalRule.count({ where: { aktif: true } }),
    prisma.employee.count({ where: { aktif: true, OR: [{ email: null }, { email: "" }] } }),
    prisma.employee.count({ where: { aktif: true, roles: { has: "ADMIN_HR" } } }),
    prisma.auditLog.findMany({ where: entitas ? { entitas } : {}, orderBy: { waktu: "desc" }, take: 100 }),
    prisma.auditLog.groupBy({ by: ["entitas"], _count: true }),
  ]);
  const mode = authMode();
  const mail = mailMode();
  const smtp = smtpSummary();
  const secret = process.env.SESSION_SECRET ?? "";
  const appUrl = process.env.APP_URL ?? "";

  const checks: Check[] = [
    { label: "Mode login", ok: mode !== "dummy", detail: mode === "dummy" ? "dummy (pilih akun tanpa password) — JANGAN dipakai di production" : mode === "ldap" ? `ldap · ${ldapConfigured() ? process.env.LDAP_URL : "LDAP_URL / template belum diatur"}` : "local (NIK + password di e-PR)" },
    ...(mode === "ldap" ? [{ label: "Konfigurasi LDAP", ok: ldapConfigured(), detail: ldapConfigured() ? "lengkap" : "isi LDAP_URL dan LDAP_USER_DN_TEMPLATE atau LDAP_SEARCH_BASE" }] : []),
    { label: "SESSION_SECRET", ok: secret.length >= 32 && !secret.startsWith("ganti-dengan"), detail: secret.startsWith("ganti-dengan") ? "masih nilai contoh — ganti dengan string acak" : `${secret.length} karakter` },
    { label: "HTTPS & cookie aman", ok: appUrl.startsWith("https://") && process.env.COOKIE_SECURE === "true", detail: `APP_URL=${appUrl || "(kosong)"} · COOKIE_SECURE=${process.env.COOKIE_SECURE ?? "false"}`, warnOnly: true },
    { label: "Email", ok: mail === "smtp" && !!process.env.SMTP_HOST, detail: mail === "smtp" ? `SMTP ${smtp.host}:${smtp.port}${smtp.secure ? " (TLS)" : ""}${smtp.auth ? " · dengan login" : " · tanpa login"} · from ${smtp.from}` : "log (simulasi, email tidak dikirim)" },
    { label: "Folder file upload", ok: storageOk, detail: `${storageDir} ${storageOk ? "dapat ditulis" : "TIDAK dapat ditulis"}` },
    { label: `Hari libur ${year} & ${year + 1}`, ok: holidaysThis > 0 && holidaysNext > 0, detail: `${holidaysThis} & ${holidaysNext} tanggal`, warnOnly: true },
    { label: "Kadiv & Direktur pembina", ok: divMissing === 0, detail: divMissing ? `${divMissing} divisi belum lengkap` : "semua divisi lengkap", warnOnly: true },
    { label: "Matriks approval", ok: rulesActive > 0, detail: `${rulesActive} aturan aktif` },
    { label: "Email karyawan aktif", ok: noEmail === 0, detail: noEmail ? `${noEmail} karyawan aktif tanpa email (tidak menerima notifikasi)` : "lengkap", warnOnly: true },
    { label: "Admin HR", ok: admins >= 2, detail: `${admins} akun aktif (disarankan ≥ 2 sebagai cadangan)`, warnOnly: true },
  ];
  const count = (s: string) => outbox.find((o) => o.statusKirim === s)?._count ?? 0;

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="mb-3 font-semibold">Kesiapan production</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-3 py-2">
              <span className={`badge mt-0.5 ${c.ok ? "bg-emerald-100 text-emerald-800" : c.warnOnly ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>
                {c.ok ? "✓ OK" : c.warnOnly ? "! Perhatian" : "✗ Belum"}
              </span>
              <div><div className="font-medium">{c.label}</div><div className="text-slate-600">{c.detail}</div></div>
            </li>
          ))}
        </ul>
        <p className="hint mt-2">Konfigurasi diubah lewat file .env di server lalu aplikasi di-restart. Pengingat approval: &gt; {reminderBusinessDays()} hari kerja.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Email</h2>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          {[["Antre", "ANTRE"], ["Sedang dikirim", "MENGIRIM"], ["Terkirim", "TERKIRIM"], ["Gagal", "GAGAL"], ["Simulasi (log)", "SIMULASI"]].map(([l, k]) => (
            <div key={k} className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">{l}</div><div className={`text-xl font-bold tabular-nums ${k === "GAGAL" && count(k) ? "text-red-700" : ""}`}>{count(k)}</div></div>
          ))}
        </div>
        <TestEmailForm defaultTo={user.email ?? ""} />
        {failed.length > 0 && (
          <div className="space-y-2">
            <RetryFailedForm />
            <ul className="divide-y divide-slate-100 text-sm">
              {failed.map((f) => (
                <li key={f.id} className="py-2">
                  <div className="font-medium">{f.subjek}</div>
                  <div className="text-xs text-slate-500">{f.penerima} · {fmtDateTime(f.waktu)} · {f.percobaan}x percobaan</div>
                  <div className="text-xs text-red-700">{f.errorTerakhir}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Audit log (100 terakhir)</h2>
          <form className="flex gap-2">
            <select name="entitas" defaultValue={entitas ?? ""} className="input w-auto">
              <option value="">Semua</option>
              {entitasList.map((e) => <option key={e.entitas} value={e.entitas}>{e.entitas} ({e._count})</option>)}
            </select>
            <button className="btn btn-secondary">Filter</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-slate-500 uppercase"><tr><th className="py-2 pr-3">Waktu</th><th className="pr-3">Entitas</th><th className="pr-3">ID</th><th className="pr-3">Aksi</th><th>Oleh</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDateTime(l.waktu)}</td>
                  <td className="pr-3">{l.entitas}</td>
                  <td className="max-w-[12rem] truncate pr-3 font-mono text-xs">{l.entitasId}</td>
                  <td className="pr-3">{l.aksi}</td>
                  <td>{l.olehNama !== "-" ? l.olehNama : l.olehNik}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
