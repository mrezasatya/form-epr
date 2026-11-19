"use client";

import { useState } from "react";
import { paperDecisionAction } from "@/app/actions/pr";
import { useAction } from "./recruitment/useAction";

/** Rekruter mencatat approval yang ditandatangani di kertas (Spec 7.4 — hybrid). */
export function PaperApprovalPanel({
  prId,
  level,
  approverNama,
  approverPeran,
  minDate,
  todayIso,
}: {
  prId: string;
  level: number;
  approverNama: string;
  approverPeran: string;
  minDate: string | null;
  todayIso: string;
}) {
  const [open, setOpen] = useState(false);
  const [keputusan, setKeputusan] = useState<"APPROVE" | "REJECT">("APPROVE");
  const { pending, error, run, setError } = useAction();

  if (!open)
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          Approval {level} ({approverPeran}: {approverNama}) sudah ditandatangani di kertas?
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Input Approval Kertas
        </button>
      </div>
    );

  return (
    <form
      className="card space-y-3"
      action={(fd) => {
        const f = fd.get("scan") as File | null;
        if (f && f.size > 5 * 1024 * 1024) return setError("Ukuran file maksimal 5 MB.");
        run(() => paperDecisionAction(prId, fd), undefined, () => setOpen(false));
      }}
    >
      <h2 className="font-semibold">Input Approval Kertas — Approval {level} ({approverPeran})</h2>
      <div className="flex gap-2">
        {(["APPROVE", "REJECT"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKeputusan(k)}
            className={`btn flex-1 sm:flex-none ${keputusan === k ? (k === "APPROVE" ? "btn-success" : "btn-danger") : "btn-secondary"}`}
          >
            {k === "APPROVE" ? "Disetujui" : "Ditolak"}
          </button>
        ))}
      </div>
      <input type="hidden" name="keputusan" value={keputusan} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label req" htmlFor="signerName">Nama Penandatangan</label>
          <input id="signerName" name="signerName" defaultValue={approverNama} maxLength={100} className="input" required />
        </div>
        <div>
          <label className="label req" htmlFor="signedDate">Tanggal Tanda Tangan</label>
          <input id="signedDate" type="date" name="signedDate" min={minDate ?? undefined} max={todayIso} defaultValue={todayIso} className="input" required />
        </div>
      </div>
      <div>
        <label className={`label ${keputusan === "REJECT" ? "req" : ""}`} htmlFor="paper-catatan">
          {keputusan === "REJECT" ? "Alasan penolakan" : "Catatan (opsional)"}
        </label>
        <textarea id="paper-catatan" name="catatan" rows={2} maxLength={500} className="input" required={keputusan === "REJECT"} />
      </div>
      <div>
        <label className="label" htmlFor="scan">Scan dokumen (PDF/JPG, maks. 5 MB, opsional)</label>
        <input id="scan" type="file" name="scan" accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg" className="input" />
      </div>
      {error && <p className="field-error">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={pending}>Batal</button>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Menyimpan…" : "Simpan Approval Kertas"}</button>
      </div>
    </form>
  );
}
