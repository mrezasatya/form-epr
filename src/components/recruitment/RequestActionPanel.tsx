"use client";

import { useState } from "react";
import type { RequestStatus } from "@prisma/client";
import { allowedActions } from "@/lib/recruitment";
import { createActionRequestAction } from "@/app/actions/recruitment";
import { useAction } from "./useAction";

const LABEL = { HOLD: "Ajukan Hold", UNHOLD: "Ajukan Unhold", CANCEL: "Ajukan Cancel" } as const;
type Jenis = keyof typeof LABEL;

/** Pemohon / Kadiv mengajukan Hold, Unhold, atau Cancel; dieksekusi rekruter (Spec 10.3). */
export function RequestActionPanel({
  prId,
  status,
  todayIso,
  pending: pendingReq,
}: {
  prId: string;
  status: RequestStatus | null;
  todayIso: string;
  pending: { jenis: string; tanggal: string } | null;
}) {
  const [jenis, setJenis] = useState<Jenis | null>(null);
  const { pending, error, success, run, setError } = useAction();
  const options = allowedActions(status).filter((a): a is Jenis => a !== "FILLED");
  if (!options.length) return null;

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Ajukan Perubahan Status</h2>
      {pendingReq ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Pengajuan <b>{pendingReq.jenis}</b> Anda sedang menunggu diproses rekruter.
        </p>
      ) : !jenis ? (
        <>
          <p className="text-sm text-slate-600">Perubahan status dieksekusi oleh rekruter setelah menerima pengajuan Anda.</p>
          {success && <p className="text-sm text-emerald-700">{success}</p>}
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button key={o} type="button" className={`btn ${o === "CANCEL" ? "btn-danger" : "btn-secondary"}`} onClick={() => setJenis(o)}>
                {LABEL[o]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <form
          className="space-y-3"
          action={(fd) => {
            const file = fd.get("memo") as File | null;
            if (file && file.size > 5 * 1024 * 1024) return setError("Ukuran file maksimal 5 MB.");
            run(() => createActionRequestAction(prId, fd), "Pengajuan terkirim ke rekruter.", () => setJenis(null));
          }}
        >
          <input type="hidden" name="jenis" value={jenis} />
          <div>
            <label className="label req" htmlFor="req-alasan">Alasan</label>
            <textarea id="req-alasan" name="alasan" rows={3} maxLength={500} className="input" required />
          </div>
          {jenis === "HOLD" && (
            <div>
              <label className="label req" htmlFor="req-estimasi">Estimasi Selesai Hold</label>
              <input id="req-estimasi" type="date" name="estimasi" min={todayIso} className="input" required />
            </div>
          )}
          <div>
            <label className="label" htmlFor="req-memo">Memo (PDF/JPG, maks. 5 MB)</label>
            <input id="req-memo" type="file" name="memo" accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg" className="input" />
          </div>
          {error && <p className="field-error">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setJenis(null)} disabled={pending}>Batal</button>
            <button className="btn btn-primary" disabled={pending}>{pending ? "Mengirim…" : `Kirim ${LABEL[jenis]}`}</button>
          </div>
        </form>
      )}
    </section>
  );
}
