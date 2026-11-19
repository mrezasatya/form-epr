import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { RuleForm } from "@/components/admin/RuleForm";
import { DeleteButton } from "@/components/admin/AdminForm";
import { deleteApprovalRuleAction } from "@/app/actions/admin";

export const metadata = { title: "Aturan Approval · Admin HR" };

export default async function RuleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "baru";
  const ruleId = Number(id);
  if (!isNew && !Number.isInteger(ruleId)) notFound();
  const [rule, divisions, people] = await Promise.all([
    isNew ? null : prisma.approvalRule.findUnique({ where: { id: ruleId } }),
    prisma.division.findMany({ orderBy: { kode: "asc" }, select: { kode: true } }),
    prisma.employee.findMany({
      where: { aktif: true, jobLevel: { in: ["Department Head", "Division Head", "Director"] } },
      orderBy: { nama: "asc" },
      select: { nik: true, nama: true, jabatan: true },
    }),
  ]);
  if (!isNew && !rule) notFound();
  return (
    <div className="max-w-4xl space-y-3">
      <div className="flex items-center justify-between">
        <Link href="/admin/approval" className="text-sm text-brand-700 hover:underline">← Matriks approval</Link>
        {rule && <DeleteButton action={deleteApprovalRuleAction.bind(null, rule.id)} confirmText={`Hapus aturan "${rule.nama}"?`} label="Hapus aturan" />}
      </div>
      <h2 className="text-lg font-semibold">{isNew ? "Aturan Approval Baru" : `Ubah: ${rule!.nama}`}</h2>
      <RuleForm rule={rule} divisions={divisions.map((d) => d.kode)} people={people} />
    </div>
  );
}
