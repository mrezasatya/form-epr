"use client";

import { useState } from "react";
import type { PrApproval } from "@prisma/client";
import { ApprovalTimeline } from "./ApprovalTimeline";

/** Status Persetujuan yang bisa diklik untuk melihat timeline approval (Spec 7.2 & 11). */
export function TimelineButton({ steps, prNo, children }: { steps: PrApproval[]; prNo: string | null; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="cursor-pointer text-left underline decoration-dotted underline-offset-4" title="Lihat timeline approval">
        {children}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">Timeline Approval</h2>
                <div className="text-sm text-slate-500">{prNo}</div>
              </div>
              <button type="button" className="btn btn-secondary min-h-9 px-3 py-1" onClick={() => setOpen(false)}>Tutup</button>
            </div>
            <ApprovalTimeline steps={steps} />
          </div>
        </div>
      )}
    </>
  );
}
