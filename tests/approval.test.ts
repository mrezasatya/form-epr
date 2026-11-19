import { describe, expect, it } from "vitest";
import { planSteps, selectRule, type RuleLike } from "@/lib/approval";

const rule = (id: number, p: Partial<RuleLike>): RuleLike => ({
  id,
  nama: `r${id}`,
  jobLevels: ["Operator"],
  divisiKode: null,
  statusEmployment: null,
  jenisKebutuhan: null,
  approvers: [],
  prioritas: 0,
  aktif: true,
  ...p,
});
const pr = { jobLevel: "Operator", divisiKode: "PRO", statusEmployment: "Contract", jenisKebutuhan: "Additional" };

describe("selectRule", () => {
  it("memilih aturan divisi spesifik di atas aturan umum", () => {
    expect(selectRule([rule(1, {}), rule(2, { divisiKode: "PRO" })], pr)?.id).toBe(2);
  });
  it("mengabaikan aturan divisi lain & nonaktif", () => {
    expect(selectRule([rule(1, {}), rule(2, { divisiKode: "ENG" }), rule(3, { aktif: false, divisiKode: "PRO" })], pr)?.id).toBe(1);
  });
  it("null bila job level tidak tercakup", () => {
    expect(selectRule([rule(1, { jobLevels: ["Section Head"] })], pr)).toBeNull();
  });
});

describe("planSteps", () => {
  const A = (level: number, nik: string) => ({ level, nik, nama: nik, peran: "x" });
  it("langkah pertama PENDING, sisanya MENUNGGU", () => {
    const { steps, firstPendingLevel } = planSteps([A(1, "k"), A(2, "h")], "p");
    expect(steps.map((s) => s.status)).toEqual(["PENDING", "MENUNGGU"]);
    expect(firstPendingLevel).toBe(1);
  });
  it("melewati approver yang sama dengan pemohon (Kadiv mengajukan)", () => {
    const { steps, firstPendingLevel } = planSteps([A(1, "kadiv"), A(2, "hrd")], "kadiv");
    expect(steps.map((s) => s.status)).toEqual(["DILEWATI", "PENDING"]);
    expect(firstPendingLevel).toBe(2);
  });
  it("melewati approver ganda (Kadiv HRD = Kepala HRD)", () => {
    const { steps } = planSteps([A(1, "siti"), A(2, "siti"), A(3, "dir")], "rudi");
    expect(steps.map((s) => s.status)).toEqual(["PENDING", "DILEWATI", "MENUNGGU"]);
  });
  it("semua dilewati → langsung disetujui", () => {
    expect(planSteps([A(1, "p")], "p").firstPendingLevel).toBeNull();
  });
});
