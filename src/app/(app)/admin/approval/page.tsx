import Link from "next/link";
import { prisma } from "@/lib/db";
import { APPROVER_ROLES, DEFAULT_REQUESTER_LEVELS } from "@/lib/constants";
import { parseApprovers } from "@/lib/approval";
import { ApprovalSimulator } from "@/components/admin/ApprovalSimulator";

export const metadata = { title: "Matriks Approval · Admin HR" };

export default async function ApprovalRulesPage() {
  const [rules, employees, divisions, usage] = await Promise.all([
    prisma.approvalRule.findMany({ orderBy: [{ aktif: "desc" }, { id: "asc" }] }),
    prisma.employee.findMany({ select: { nik: true, nama: true, jobLevel: true, isRequesterExtra: true, divisiKode: true }, orderBy: { nama: "asc" } }),
    prisma.division.findMany({ orderBy: { kode: "asc" }, select: { kode: true } }),
    prisma.prRequest.groupBy({ by: ["approvalRuleId"], _count: true }),
  ]);
  const name = new Map(employees.map((e) => [e.nik, e.nama]));
  const used = new Map(usage.map((u) => [u.approvalRuleId, u._count]));
  const label = (a: { type: string; value: string }) => (a.type === "ROLE" ? APPROVER_ROLES[a.value] : `${name.get(a.value) ?? a.value} (khusus)`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-sm text-slate-600">
          Saat PR diajukan, sistem memilih aturan aktif yang cocok dan <b>paling spesifik</b> (Divisi &gt; Status of Employment &gt; Jenis
          Kebutuhan; kolom kosong = semua). Bila sama spesifiknya, angka prioritas terbesar dipakai. Perubahan hanya berlaku untuk PR
          yang diajukan setelahnya.
        </p>
        <Link href="/admin/approval/baru" className="btn btn-primary">+ Aturan Baru</Link>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr><th className="px-3 py-2">Aturan</th><th className="px-3 py-2">Kondisi</th><th className="px-3 py-2">Approval 1</th><th className="px-3 py-2">Approval 2</th><th className="px-3 py-2">Approval 3</th><th className="px-3 py-2">Dipakai</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((r) => {
              const ap = parseApprovers(r.approvers);
              return (
                <tr key={r.id} className={`align-top ${r.aktif ? "" : "opacity-50"}`}>
                  <td className="px-3 py-2">
                    <Link href={`/admin/approval/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.nama}</Link>
                    {!r.aktif && <span className="badge ml-1 bg-slate-200">Nonaktif</span>}
                    <div className="text-xs text-slate-500">Prioritas {r.prioritas}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div><b>Job Level:</b> {r.jobLevels.join(", ")}</div>
                    <div><b>Divisi:</b> {r.divisiKode ?? "semua"} · <b>Status:</b> {r.statusEmployment ?? "semua"} · <b>Jenis:</b> {r.jenisKebutuhan ?? "semua"}</div>
                  </td>
                  {[0, 1, 2].map((i) => <td key={i} className="px-3 py-2">{ap[i] ? label(ap[i]) : "—"}</td>)}
                  <td className="px-3 py-2 tabular-nums">{used.get(r.id) ?? 0} PR</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ApprovalSimulator
        divisions={divisions.map((d) => d.kode)}
        requesters={employees.filter((e) => DEFAULT_REQUESTER_LEVELS.includes(e.jobLevel) || e.isRequesterExtra)}
      />
    </div>
  );
}
