import { describe, expect, it } from "vitest";
import { allowedActions, fulfillmentDateOf, placementDays, realisasi, validateCandidate } from "@/lib/recruitment";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const cands = [
  { status: "Joined", tanggalJoin: d("2026-12-01") },
  { status: "Joined", tanggalJoin: d("2026-12-15") },
  { status: "Batal", tanggalJoin: d("2026-12-20") },
  { status: "Offer Accepted", tanggalJoin: d("2026-12-30") },
];

describe("realisasi & fulfillment", () => {
  it("hanya menghitung Joined", () => expect(realisasi(cands)).toBe(2));
  it("fulfillment = tanggal join Joined terakhir", () =>
    expect(fulfillmentDateOf(cands)?.toISOString().slice(0, 10)).toBe("2026-12-15"));
  it("placement time dalam hari kalender", () => expect(placementDays(d("2026-11-19"), d("2026-12-15"))).toBe(26));
  it("null bila belum ada Joined", () => expect(fulfillmentDateOf([])).toBeNull());
});

describe("transisi status", () => {
  it("Open → Hold/Cancel/Filled", () => expect(allowedActions("OPEN")).toEqual(["HOLD", "CANCEL", "FILLED"]));
  it("On Hold → Unhold/Cancel", () => expect(allowedActions("ON_HOLD")).toEqual(["UNHOLD", "CANCEL"]));
  it("Filled & Cancelled final", () => {
    expect(allowedActions("FILLED")).toEqual([]);
    expect(allowedActions("CANCELLED")).toEqual([]);
  });
});

describe("validasi kandidat", () => {
  const ctx = { prReceivedDate: d("2026-11-19"), kebutuhan: 2, joinedOthers: 1 };
  const base = { nama: "Ani", sumber: "LinkedIn", status: "Joined", tanggalJoin: d("2026-12-01") };
  it("valid", () => expect(validateCandidate(base, ctx)).toBeNull());
  it("Joined wajib tanggal", () => expect(validateCandidate({ ...base, tanggalJoin: null }, ctx)).toMatch(/wajib/));
  it("tidak boleh sebelum PR Received", () =>
    expect(validateCandidate({ ...base, tanggalJoin: d("2026-11-01") }, ctx)).toMatch(/sebelum/));
  it("Joined tidak boleh melebihi Kebutuhan", () =>
    expect(validateCandidate(base, { ...ctx, joinedOthers: 2 })).toMatch(/melebihi/));
});
