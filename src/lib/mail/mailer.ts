import "server-only";
import { readFileSync } from "node:fs";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Pengirim email via SMTP perusahaan (MAIL_MODE=smtp).
 * Variabel: SMTP_HOST, SMTP_PORT (25/587/465), SMTP_SECURE (true utk 465), SMTP_USER, SMTP_PASSWORD
 * (kosongkan bila relay internal tanpa autentikasi), SMTP_FROM, SMTP_TLS_CA_FILE, SMTP_TLS_REJECT_UNAUTHORIZED.
 */
let transporter: Transporter | null = null;

export function mailMode(): "log" | "smtp" {
  return process.env.MAIL_MODE === "smtp" ? "smtp" : "log";
}

export function smtpSummary() {
  return {
    host: process.env.SMTP_HOST ?? "(belum diatur)",
    port: Number(process.env.SMTP_PORT ?? 25),
    secure: process.env.SMTP_SECURE === "true",
    auth: !!process.env.SMTP_USER,
    from: process.env.SMTP_FROM ?? "(belum diatur)",
  };
}

/** Dipakai pengujian: buang transporter tersimpan agar konfigurasi SMTP dibaca ulang. */
export function __reset() {
  transporter = null;
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) throw new Error("SMTP_HOST belum diatur.");
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 25),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    tls: {
      ca: process.env.SMTP_TLS_CA_FILE ? [readFileSync(process.env.SMTP_TLS_CA_FILE)] : undefined,
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Template email sederhana (tanpa gambar/font eksternal — aman untuk jaringan internal). */
export function renderEmail(m: { subjek: string; isi: string; link?: string | null }) {
  const footer = "Email ini dikirim otomatis oleh sistem e-PR. Mohon tidak membalas email ini.";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px">
<tr><td style="padding:16px 24px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#174c99">e-PR · Personnel Request</td></tr>
<tr><td style="padding:24px"><h1 style="font-size:18px;margin:0 0 12px">${esc(m.subjek)}</h1>
<div style="font-size:14px;line-height:1.6">${esc(m.isi).replace(/\n/g, "<br>")}</div>
${m.link ? `<p style="margin:24px 0 0"><a href="${esc(m.link)}" style="background:#1d5fbf;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;display:inline-block">Buka di e-PR</a></p>
<p style="font-size:12px;color:#64748b;margin:12px 0 0">Atau salin tautan: ${esc(m.link)}</p>` : ""}
</td></tr><tr><td style="padding:12px 24px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0">${footer}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${m.subjek}\n\n${m.isi}${m.link ? `\n\nBuka di e-PR: ${m.link}` : ""}\n\n--\n${footer}`;
  return { html, text };
}

export async function sendMail(to: string, m: { subjek: string; isi: string; link?: string | null }) {
  const { html, text } = renderEmail(m);
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM ?? "e-PR <no-reply@localhost>",
    to,
    subject: m.subjek,
    text,
    html,
  });
}
