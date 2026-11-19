import { describe, expect, it } from "vitest";
import { generateTempPassword, hashPassword, passwordPolicyError, verifyPassword } from "@/lib/auth/password";
import { buildUserDn, escapeDn, escapeFilter } from "@/lib/auth/ldap";
import { renderEmail } from "@/lib/mail/mailer";

describe("kebijakan password", () => {
  it("menolak password lemah", () => {
    expect(passwordPolicyError("abc123", "300001")).toMatch(/minimal 8/);
    expect(passwordPolicyError("abcdefgh", "300001")).toMatch(/huruf dan angka/);
    expect(passwordPolicyError("rudi300001", "300001")).toMatch(/NIK/);
  });
  it("menerima password yang memenuhi syarat", () => expect(passwordPolicyError("Workshop2026", "300001")).toBeNull());
  it("password sementara memenuhi kebijakan & tanpa karakter ambigu", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateTempPassword();
      expect(passwordPolicyError(p, "999999")).toBeNull();
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });
  it("hash & verifikasi", async () => {
    const h = await hashPassword("Rahasia123");
    expect(await verifyPassword("Rahasia123", h)).toBe(true);
    expect(await verifyPassword("rahasia123", h)).toBe(false);
  });
});

describe("LDAP escaping (mencegah LDAP injection)", () => {
  it("escape filter RFC 4515", () => expect(escapeFilter("*)(uid=*")).toBe("\\2a\\29\\28uid=\\2a"));
  it("escape DN RFC 4514", () => expect(escapeDn("a,b=c+d")).toBe("a\\,b\\=c\\+d"));
  it("template DN", () => {
    expect(buildUserDn("{nik}@perusahaan.local", "300001")).toBe("300001@perusahaan.local");
    expect(buildUserDn("uid={nik},ou=People,dc=x", "a,b")).toBe("uid=a\\,b,ou=People,dc=x");
  });
});

describe("template email", () => {
  it("meng-escape HTML dari isi PR", () => {
    const { html, text } = renderEmail({ subjek: "PR <b>x</b>", isi: 'Job "Welder" & <script>', link: "https://epr.local/pr/1" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="https://epr.local/pr/1"');
    expect(text).toContain("Buka di e-PR: https://epr.local/pr/1");
  });
});
