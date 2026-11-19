import type { PrApproval } from "@prisma/client";
import { fmtDateTime } from "@/lib/dates";

const STYLE: Record<PrApproval["status"], [string, string]> = {
  MENUNGGU: ["Belum giliran", "bg-slate-300"],
  PENDING: ["Menunggu keputusan", "bg-amber-500 ring-4 ring-amber-100"],
  DISETUJUI: ["Disetujui", "bg-emerald-600"],
  DITOLAK: ["Ditolak", "bg-red-600"],
  DILEWATI: ["Dilewati otomatis", "bg-slate-400"],
  DIBATALKAN: ["Tidak diproses", "bg-slate-200"],
};

export function ApprovalTimeline({ steps }: { steps: PrApproval[] }) {
  if (!steps.length) return <p className="text-sm text-slate-500">Belum diajukan.</p>;
  return (
    <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
      {steps.map((s) => {
        const [label, dot] = STYLE[s.status];
        return (
          <li key={s.id} className="relative">
            <span className={`absolute top-1.5 -left-[27px] h-3 w-3 rounded-full ${dot}`} />
            <div className="text-xs font-semibold text-slate-500 uppercase">
              Approval {s.level} · {s.approverPeran}
            </div>
            <div className="font-medium">{s.approverNama}</div>
            <div className="text-sm text-slate-600">
              {label}
              {s.tanggal && <> · {fmtDateTime(s.tanggal)}</>}
              {s.sumber === "KERTAS" && <> · approval kertas</>}
            </div>
            {s.catatan && <div className="mt-1 rounded bg-slate-50 p-2 text-sm text-slate-700">“{s.catatan}”</div>}
          </li>
        );
      })}
    </ol>
  );
}
