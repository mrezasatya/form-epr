"use client";

import { useState } from "react";
import type { RequestStatus } from "@prisma/client";
import { ACTION_LABEL, allowedActions, type StatusAction } from "@/lib/recruitment";
import { fmtDate } from "@/lib/dates";
import { changeStatusAction, rejectActionRequestAction } from "@/app/actions/recruitment";
import { useAction } from "./useAction";

export type PendingRequestView = {
  id: string;
  jenis: StatusAction;
  alasan: string;
  estimasiSelesai: string | null;
  fileMemo: string | null;
  olehNama: string;
  tanggal: string;
};

const BTN: Record<StatusAction, string> = {
  HOLD: "btn-secondary",
  UNHOLD: "btn-secondary",
  CANCEL: "btn-danger",
  FILLED: "btn-success",
};

/** Ubah Status Permintaan oleh rekruter (Spec 10.3) + eksekusi pengajuan pemohon. */
export function StatusActions({
  prId,
  status,
  realisasi,
  kebutuhan,
  todayIso,
  pendingRequest,
  assigned,
}: {
  prId: string;
  status: RequestStatus | null;
  realisasi: number;
  kebutuhan: number;
  todayIso: string;
  pendingRequest: PendingRequestView | null;
  assigned: boolean;
}) {
  const [open, setOpen] = useState<{ aksi: StatusAction; fromRequest?: PendingRequestView } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [catatan, setCatatan] = useState("");
  const rej = useAction();
  const actions = allowedActions(status);
  if (!actions.length && !pendingRequest) return null;

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Status Permintaan</h2>

      {pendingRequest && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <div className="font-semibold text-red-800">
            Pengajuan {pendingRequest.jenis} dari {pendingRequest.olehNama} · {fmtDate(pendingRequest.tanggal)}
          </div>
          <div className="mt-1 text-slate-700">Alasan: {pendingRequest.alasan}</div>
          {pendingRequest.estimasiSelesai && <div className="text-slate-700">Estimasi selesai: {fmtDate(pendingRequest.estimasiSelesai)}</div>}
          {pendingRequest.fileMemo && (
            <a className="text-brand-700 underline" href={`/api/files/${pendingRequest.fileMemo}`} target="_blank">Lihat memo</a>
          )}
          {!rejecting ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {actions.includes(pendingRequest.jenis) && (
                <button type="button" className="btn btn-primary" onClick={() => setOpen({ aksi: pendingRequest.jenis, fromRequest: pendingRequest })}>
                  Eksekusi {ACTION_LABEL[pendingRequest.jenis]}
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setRejecting(true)}>Tidak diproses</button>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <textarea className="input" rows={2} placeholder="Alasan tidak diproses (wajib)" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
              {rej.error && <p className="field-error">{rej.error}</p>}
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setRejecting(false)}>Batal</button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={rej.pending}
                  onClick={() => rej.run(() => rejectActionRequestAction(prId, pendingRequest.id, catatan), undefined, () => setRejecting(false))}
                >
                  Konfirmasi
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {status === "OPEN" && realisasi >= kebutuhan && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Realisasi sudah memenuhi Kebutuhan ({realisasi}/{kebutuhan}). Disarankan mengubah status menjadi <b>Filled</b>.
        </div>
      )}
      {!assigned && <p className="text-sm text-red-600">Isi Prioritas dan Recruiter PIC terlebih dahulu.</p>}

      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a} type="button" disabled={!assigned} className={`btn ${BTN[a]}`} onClick={() => setOpen({ aksi: a })}>
            {ACTION_LABEL[a]}
          </button>
        ))}
      </div>

      {open && (
        <StatusDialog
          prId={prId}
          aksi={open.aksi}
          fromRequest={open.fromRequest}
          todayIso={todayIso}
          partial={open.aksi === "FILLED" && realisasi < kebutuhan}
          realisasi={realisasi}
          kebutuhan={kebutuhan}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

function StatusDialog({
  prId,
  aksi,
  fromRequest,
  todayIso,
  partial,
  realisasi,
  kebutuhan,
  onClose,
}: {
  prId: string;
  aksi: StatusAction;
  fromRequest?: PendingRequestView;
  todayIso: string;
  partial: boolean;
  realisasi: number;
  kebutuhan: number;
  onClose: () => void;
}) {
  const { pending, error, run, setError } = useAction();
  const alasanRequired = aksi === "HOLD" || aksi === "CANCEL" || partial;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <form
        className="max-h-[92vh] w-full space-y-3 overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-lg sm:rounded-2xl"
        action={(fd) => {
          const file = fd.get("memo") as File | null;
          if (file && file.size > 5 * 1024 * 1024) return setError("Ukuran file maksimal 5 MB.");
          run(() => changeStatusAction(prId, fd), undefined, onClose);
        }}
      >
        <h2 className="text-lg font-bold">Ubah status: {ACTION_LABEL[aksi]}</h2>
        <input type="hidden" name="aksi" value={aksi} />
        {fromRequest && <input type="hidden" name="actionRequestId" value={fromRequest.id} />}
        {aksi === "FILLED" && (
          <p className="text-sm text-slate-600">
            Realisasi {realisasi}/{kebutuhan}. Fulfillment Date diisi otomatis dari tanggal join kandidat terakhir dan Tahap menjadi Closed.
          </p>
        )}
        {aksi === "CANCEL" && <p className="text-sm text-slate-600">PR yang dibatalkan bersifat final.</p>}
        <div>
          <label className={`label ${alasanRequired ? "req" : ""}`} htmlFor="alasan">
            {aksi === "HOLD" ? "Alasan Hold" : aksi === "FILLED" ? "Alasan (realisasi belum penuh)" : "Alasan / keterangan"}
          </label>
          <textarea id="alasan" name="alasan" rows={3} maxLength={500} className="input" defaultValue={fromRequest?.alasan} required={alasanRequired} />
        </div>
        {aksi === "HOLD" && (
          <div>
            <label className="label req" htmlFor="estimasi">Estimasi Selesai Hold</label>
            <input id="estimasi" type="date" name="estimasi" min={todayIso} className="input" defaultValue={fromRequest?.estimasiSelesai ?? ""} required />
          </div>
        )}
        {aksi !== "FILLED" && (
          <div>
            <label className="label" htmlFor="memo">Memo {aksi === "UNHOLD" ? "unhold" : aksi === "HOLD" ? "hold" : "cancel"} (PDF/JPG, maks. 5 MB)</label>
            <input id="memo" type="file" name="memo" accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg" className="input" />
            {fromRequest?.fileMemo && <p className="hint">Memo dari pemohon sudah terlampir di pengajuan.</p>}
          </div>
        )}
        {error && <p className="field-error">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Batal</button>
          <button className={`btn ${aksi === "CANCEL" ? "btn-danger" : "btn-primary"}`} disabled={pending}>
            {pending ? "Memproses…" : `Konfirmasi ${ACTION_LABEL[aksi]}`}
          </button>
        </div>
      </form>
    </div>
  );
}
