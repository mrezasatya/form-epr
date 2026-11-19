import { describe, expect, it } from "vitest";
import { addBusinessDays, fmtDate, todayWib, toIsoDate, calendarDaysBetween } from "@/lib/dates";
import { formatPrNo } from "@/lib/prno";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("hari kerja", () => {
  it("melewati Sabtu-Minggu", () => {
    // Jumat 20/11/2026 + 1 hari kerja = Senin 23/11/2026
    expect(toIsoDate(addBusinessDays(d("2026-11-20"), 1, new Set()))).toBe("2026-11-23");
  });
  it("melewati hari libur", () => {
    // Kamis 24/12 & Jumat 25/12 libur → Rabu 23/12 + 1 = Senin 28/12
    const h = new Set(["2026-12-24", "2026-12-25"]);
    expect(toIsoDate(addBusinessDays(d("2026-12-23"), 1, h))).toBe("2026-12-28");
  });
  it("45 hari kerja tanpa libur = 9 minggu", () => {
    expect(calendarDaysBetween(d("2026-11-16"), addBusinessDays(d("2026-11-16"), 45, new Set()))).toBe(63);
  });
  it("tanggal hari ini mengikuti WIB", () => {
    // 18/11 pukul 20:00 UTC = 19/11 pukul 03:00 WIB
    expect(toIsoDate(todayWib(new Date("2026-11-18T20:00:00Z")))).toBe("2026-11-19");
  });
  it("format DD/MM/YYYY", () => {
    expect(fmtDate(d("2026-01-05"))).toBe("05/01/2026");
  });
});

describe("PR NO", () => {
  it("format NNN/SDM/PR/ROMAWI/TAHUN", () => {
    expect(formatPrNo(1, d("2026-11-19"))).toBe("001/SDM/PR/XI/2026");
    expect(formatPrNo(42, d("2027-04-01"))).toBe("042/SDM/PR/IV/2027");
  });
});
