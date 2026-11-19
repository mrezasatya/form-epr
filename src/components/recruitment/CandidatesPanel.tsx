"use client";

import { useState } from "react";
import { STATUS_KANDIDAT, SUMBER_KANDIDAT } from "@/lib/constants";
import { fmtDate } from "@/lib/dates";
import { deleteCandidateAction, saveCandidateAction } from "@/app/actions/recruitment";
import { useAction } from "./useAction";

export type CandidateView = { id: string; nama: string; sumber: string; status: string; tanggalJoin: string | null };

const STATUS_CLS: Record<string, string> = {
  Joined: "bg-emerald-100 text-emerald-800",
  "Offer Accepted": "bg-blue-100 text-blue-800",
  Batal: "bg-slate-200 text-slate-600",
};

export function CandidatesPanel({
  prId,
  candidates,
  kebutuhan,
  editable,
  minJoin,
}: {
  prId: string;
  candidates: CandidateView[];
  kebutuhan: number;
  editable: boolean;
  minJoin: string | null;
}) {
  const [editing, setEditing] = useState<CandidateView | "new" | null>(null);
  const { pending, error, run } = useAction();
  const joined = candidates.filter((c) => c.status === "Joined").length;

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Kandidat Final</h2>
        <span className="text-sm text-slate-600">
          Realisasi <b>{joined}</b> / {kebutuhan}
        </span>
      </div>
      {candidates.length === 0 && <p className="text-sm text-slate-500">Belum ada kandidat.</p>}
      <ul className="divide-y divide-slate-100">
        {candidates.map((c) =>
          editing !== "new" && editing?.id === c.id ? (
            <li key={c.id} className="py-2">
              <CandidateForm prId={prId} value={c} minJoin={minJoin} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <div className="font-medium">{c.nama}</div>
                <div className="text-xs text-slate-500">
                  {c.sumber}
                  {c.tanggalJoin && <> · Join {fmtDate(c.tanggalJoin)}</>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${STATUS_CLS[c.status] ?? ""}`}>{c.status}</span>
                {editable && (
                  <>
                    <button type="button" className="text-sm text-brand-700 hover:underline" onClick={() => setEditing(c)}>
                      Ubah
                    </button>
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      disabled={pending}
                      onClick={() => confirm(`Hapus kandidat ${c.nama}?`) && run(() => deleteCandidateAction(prId, c.id))}
                    >
                      Hapus
                    </button>
                  </>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
      {error && <p className="field-error">{error}</p>}
      {editable &&
        (editing === "new" ? (
          <CandidateForm prId={prId} minJoin={minJoin} onDone={() => setEditing(null)} />
        ) : (
          <button type="button" className="btn btn-secondary w-full sm:w-auto" onClick={() => setEditing("new")}>
            + Tambah Kandidat
          </button>
        ))}
    </section>
  );
}

function CandidateForm({
  prId,
  value,
  minJoin,
  onDone,
}: {
  prId: string;
  value?: CandidateView;
  minJoin: string | null;
  onDone: () => void;
}) {
  const { pending, error, run } = useAction();
  const [status, setStatus] = useState(value?.status ?? "");
  return (
    <form
      className="space-y-3 rounded-lg bg-slate-50 p-3"
      action={(fd) => run(() => saveCandidateAction(prId, fd), undefined, onDone)}
    >
      {value && <input type="hidden" name="id" value={value.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label req">Nama Kandidat</label>
          <input name="nama" defaultValue={value?.nama} maxLength={100} className="input" required />
        </div>
        <div>
          <label className="label req">Sumber</label>
          <select name="sumber" defaultValue={value?.sumber ?? ""} className="input" required>
            <option value="">— Pilih —</option>
            {SUMBER_KANDIDAT.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label req">Status</label>
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="input" required>
            <option value="">— Pilih —</option>
            {STATUS_KANDIDAT.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={`label ${status === "Joined" ? "req" : ""}`}>Tanggal Join</label>
          <input type="date" name="tanggalJoin" min={minJoin ?? undefined} defaultValue={value?.tanggalJoin ?? ""} className="input" required={status === "Joined"} />
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary" onClick={onDone} disabled={pending}>Batal</button>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Menyimpan…" : "Simpan Kandidat"}</button>
      </div>
    </form>
  );
}
