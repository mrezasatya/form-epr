// Uji integrasi login LDAP ke OpenLDAP sungguhan (jalankan dulu: bash tests/integration/slapd-setup.sh).
import { describe, expect, it } from "vitest";
import { ldapAuthenticate } from "@/lib/auth/ldap";

const URL = "ldap://127.0.0.1:3899";
const reset = () => {
  for (const k of ["LDAP_USER_DN_TEMPLATE", "LDAP_BIND_DN", "LDAP_BIND_PASSWORD", "LDAP_SEARCH_BASE", "LDAP_SEARCH_FILTER"]) delete process.env[k];
  process.env.LDAP_URL = URL;
};

describe("Pola A — bind langsung (username = NIK)", () => {
  it("password benar/salah/kosong", async () => {
    reset();
    process.env.LDAP_USER_DN_TEMPLATE = "uid={nik},ou=karyawan,dc=contoh,dc=local";
    expect(await ldapAuthenticate("300001", "Rahasia123")).toEqual({ ok: true });
    expect(await ldapAuthenticate("300001", "salah")).toMatchObject({ ok: false, reason: "invalid" });
    expect(await ldapAuthenticate("300001", "")).toMatchObject({ ok: false, reason: "invalid" });
    expect(await ldapAuthenticate("999999", "Rahasia123")).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("karakter khusus di NIK di-escape (tidak bisa menyusup ke DN lain)", async () => {
    reset();
    process.env.LDAP_USER_DN_TEMPLATE = "uid={nik},ou=karyawan,dc=contoh,dc=local";
    expect(await ldapAuthenticate("300001,ou=karyawan", "Rahasia123")).toMatchObject({ ok: false });
  });
});

describe("Pola B — cari dengan akun layanan, lalu bind (username ≠ NIK)", () => {
  const setB = () => {
    reset();
    Object.assign(process.env, {
      LDAP_BIND_DN: "cn=svc-epr,ou=service,dc=contoh,dc=local",
      LDAP_BIND_PASSWORD: "svcpass",
      LDAP_SEARCH_BASE: "ou=karyawan,dc=contoh,dc=local",
      LDAP_SEARCH_FILTER: "(employeeNumber={nik})",
    });
  };
  it("NIK 300002 → uid=maya.putri", async () => {
    setB();
    expect(await ldapAuthenticate("300002", "Rahasia456")).toEqual({ ok: true });
    expect(await ldapAuthenticate("300002", "Rahasia123")).toMatchObject({ ok: false, reason: "invalid" });
    expect(await ldapAuthenticate("888888", "Rahasia456")).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("injeksi filter '*' tidak mencocokkan akun mana pun", async () => {
    setB();
    expect(await ldapAuthenticate("*", "Rahasia456")).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("password akun layanan salah → error sistem (bukan 'password salah')", async () => {
    setB();
    process.env.LDAP_BIND_PASSWORD = "keliru";
    expect(await ldapAuthenticate("300002", "Rahasia456")).toMatchObject({ ok: false, reason: "error" });
  });
});

describe("Server tidak dapat dihubungi", () => {
  it("→ error sistem", async () => {
    reset();
    process.env.LDAP_URL = "ldap://127.0.0.1:3999";
    process.env.LDAP_USER_DN_TEMPLATE = "uid={nik},ou=karyawan,dc=contoh,dc=local";
    expect(await ldapAuthenticate("300001", "Rahasia123")).toMatchObject({ ok: false, reason: "error" });
  });
});
