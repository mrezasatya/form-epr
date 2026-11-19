"use client";

import { PRIORITAS, RECRUITER_PIC, TAHAP_DETAIL } from "@/lib/constants";
import { updateRecruitmentAction } from "@/app/actions/recruitment";
import { useAction } from "./useAction";

export function ProcessForm({
  prId,
  initial,
  closed,
}: {
  prId: string;
  initial: { prioritas: string; recruiterPic: string; tahapDetail: string; targetStartDate: string; progressNote: string; note: string };
  closed: boolean;
}) {
  const { pending, error, success, run } = useAction();
  return (
    <form
      className="card space-y-3"
      action={(fd) => run(() => updateRecruitmentAction(prId, fd), "Data proses tersimpan.")}
    >
      <h2 className="font-semibold">Data Proses Rekrutmen</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label req" htmlFor="prioritas">Prioritas</label>
          <select id="prioritas" name="prioritas" defaultValue={initial.prioritas} className="input" required>
            <option value="">— Pilih —</option>
            {PRIORITAS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label req" htmlFor="recruiterPic">Recruiter PIC</label>
          <select id="recruiterPic" name="recruiterPic" defaultValue={initial.recruiterPic} className="input" required>
            <option value="">— Pilih —</option>
            {RECRUITER_PIC.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tahapDetail">Tahap Saat Ini</label>
          <select id="tahapDetail" name="tahapDetail" defaultValue={initial.tahapDetail} className="input" disabled={closed}>
            <option value="">(belum diisi — Menunggu)</option>
            {TAHAP_DETAIL.filter((t) => t !== "Closed" || closed).map((t) => <option key={t}>{t}</option>)}
          </select>
          {closed && <input type="hidden" name="tahapDetail" value={initial.tahapDetail} />}
        </div>
        <div>
          <label className="label" htmlFor="targetStartDate">Target Start Date</label>
          <input id="targetStartDate" type="date" name="targetStartDate" defaultValue={initial.targetStartDate} className="input" />
          <p className="hint">Default: PR Received + 45 hari kerja</p>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="progressNote">Progress Note <span className="font-normal text-slate-500">(tampil ke pemohon & Kadiv)</span></label>
        <textarea id="progressNote" name="progressNote" rows={2} maxLength={1000} defaultValue={initial.progressNote} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="note">Note <span className="font-normal text-slate-500">(internal rekruter)</span></label>
        <textarea id="note" name="note" rows={2} maxLength={1000} defaultValue={initial.note} className="input" />
      </div>
      {error && <p className="field-error">{error}</p>}
      {success && <p className="text-sm text-emerald-700">{success}</p>}
      <button className="btn btn-primary w-full sm:w-auto" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan Data Proses"}
      </button>
    </form>
  );
}
