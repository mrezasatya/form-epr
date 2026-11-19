import "server-only";
import { readFileSync } from "node:fs";
import { Client } from "ldapts";

/**
 * Login ke ESS / Active Directory lewat LDAP (AUTH_MODE=ldap).
 * Dua pola yang umum dipakai IT:
 *  A. Bind langsung   : LDAP_USER_DN_TEMPLATE="{nik}@perusahaan.local"  (UPN Active Directory)
 *                       atau "uid={nik},ou=People,dc=perusahaan,dc=local"
 *  B. Cari lalu bind  : LDAP_BIND_DN + LDAP_BIND_PASSWORD (akun layanan), LDAP_SEARCH_BASE,
 *                       LDAP_SEARCH_FILTER="(employeeID={nik})" — bila username AD ≠ NIK.
 * Password TIDAK disimpan di e-PR. Koneksi terenkripsi: pakai ldaps:// (636) atau ldap:// + LDAP_STARTTLS=true.
 */

/** Escape nilai untuk filter LDAP (RFC 4515). */
export function escapeFilter(v: string): string {
  return v.replace(/[\\*()\0]/g, (c) => "\\" + c.charCodeAt(0).toString(16).padStart(2, "0"));
}

/** Escape nilai untuk komponen DN (RFC 4514). */
export function escapeDn(v: string): string {
  return v
    .replace(/[\\,+"<>;=]/g, (c) => "\\" + c)
    .replace(/^[ #]/, (c) => "\\" + c)
    .replace(/ $/, "\\ ");
}

export function buildUserDn(template: string, nik: string): string {
  return template.replaceAll("{nik}", escapeDn(nik));
}

export type LdapResult = { ok: true } | { ok: false; reason: "invalid" | "error"; detail?: string };

export function ldapConfigured(): boolean {
  return !!process.env.LDAP_URL && !!(process.env.LDAP_USER_DN_TEMPLATE || process.env.LDAP_SEARCH_BASE);
}

export async function ldapAuthenticate(nik: string, password: string): Promise<LdapResult> {
  if (!ldapConfigured()) return { ok: false, reason: "error", detail: "LDAP belum dikonfigurasi" };
  if (!password) return { ok: false, reason: "invalid" }; // bind tanpa password = "anonymous bind" → selalu tolak
  const url = process.env.LDAP_URL!;
  const tlsOptions = {
    ca: process.env.LDAP_TLS_CA_FILE ? [readFileSync(process.env.LDAP_TLS_CA_FILE)] : undefined,
    rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== "false",
  };
  // TLS langsung hanya untuk ldaps://. Untuk ldap:// (port 389) gunakan LDAP_STARTTLS=true agar password terenkripsi.
  const client = new Client({
    url,
    timeout: 8000,
    connectTimeout: 5000,
    ...(url.startsWith("ldaps://") && { tlsOptions }),
  });
  try {
    if (!url.startsWith("ldaps://") && process.env.LDAP_STARTTLS === "true") await client.startTLS(tlsOptions);
    let userDn: string;
    if (process.env.LDAP_SEARCH_BASE) {
      try {
        await client.bind(process.env.LDAP_BIND_DN ?? "", process.env.LDAP_BIND_PASSWORD ?? "");
      } catch (e) {
        // Kesalahan konfigurasi (akun layanan), BUKAN password pengguna yang salah.
        return { ok: false, reason: "error", detail: `Bind akun layanan gagal: ${(e as Error).name} ${(e as Error).message}` };
      }
      const filter = (process.env.LDAP_SEARCH_FILTER ?? "(sAMAccountName={nik})").replaceAll("{nik}", escapeFilter(nik));
      const { searchEntries } = await client.search(process.env.LDAP_SEARCH_BASE, { scope: "sub", filter, sizeLimit: 2, attributes: ["dn"] });
      if (searchEntries.length !== 1) return { ok: false, reason: "invalid" };
      userDn = searchEntries[0].dn;
      await client.unbind();
    } else {
      userDn = buildUserDn(process.env.LDAP_USER_DN_TEMPLATE!, nik);
    }
    await client.bind(userDn, password);
    return { ok: true };
  } catch (e) {
    const name = (e as Error).name ?? "";
    if (name === "InvalidCredentialsError") return { ok: false, reason: "invalid" };
    return { ok: false, reason: "error", detail: `${name}: ${(e as Error).message}` };
  } finally {
    await client.unbind().catch(() => {});
  }
}
