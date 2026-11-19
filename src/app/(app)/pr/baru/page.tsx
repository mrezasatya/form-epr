import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadFormMasters } from "@/lib/form-masters";
import { canViewPr, prToForm } from "@/lib/pr-service";
import { emptyPrForm, type PrFormInput } from "@/lib/pr-schema";
import { PrForm } from "@/components/PrForm";

export const metadata = { title: "Buat PR" };

export default async function NewPrPage({ searchParams }: { searchParams: Promise<{ dari?: string; draft?: string }> }) {
  const user = await requireUser();
  if (!user.canRequest)
    return (
      <div className="card">
        <h1 className="page-title mb-2">Buat PR</h1>
        <p className="text-slate-600">
          Akun Anda belum memiliki hak sebagai pemohon. Pemohon default adalah Dept Head, Kepala Divisi, dan Direksi;
          Section Head/PM dapat diberi hak oleh Admin HR.
        </p>
      </div>
    );

  const { dari, draft } = await searchParams;
  const masters = await loadFormMasters(user);
  let initial: PrFormInput = emptyPrForm(masters.departments.includes(user.departemenKode) ? user.departemenKode : (masters.departments[0] ?? ""));
  let sourcePrNo: string | null = null;
  let draftId: string | undefined;

  if (draft) {
    const pr = await prisma.prRequest.findUnique({ where: { id: draft }, include: { replacedEmployees: true } });
    if (!pr || pr.requesterNik !== user.nik || pr.statusPersetujuan !== "DRAFT") redirect("/pr");
    initial = prToForm(pr);
    draftId = pr.id;
  } else if (dari) {
    const pr = await prisma.prRequest.findUnique({ where: { id: dari }, include: { replacedEmployees: true } });
    if (pr && (await canViewPr(user, pr))) {
      initial = { ...prToForm(pr), expectedDate: "", expectedDateManual: false };
      if (!masters.departments.includes(initial.departemenKode)) initial.departemenKode = user.departemenKode;
      sourcePrNo = pr.prNo;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="page-title">{draftId ? "Lanjutkan Draft PR" : "Form e-PR"}</h1>
          <p className="text-sm text-slate-500">Isian bertanda * wajib diisi.</p>
        </div>
        <Link href="/pr" className="btn btn-secondary">
          Batal
        </Link>
      </div>
      <PrForm
        initial={initial}
        masters={masters}
        profile={{ nama: user.nama, divisiKode: user.divisiKode }}
        draftId={draftId}
        sourcePrNo={sourcePrNo}
      />
    </div>
  );
}
