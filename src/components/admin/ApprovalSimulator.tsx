"use client";

import { useState, useTransition } from "react";
import { JENIS_KEBUTUHAN, JOB_LEVELS, STATUS_EMPLOYMENT } from "@/lib/constants";
import { previewApprovalAction } from "@/app/actions/admin";

type Res = Awaited<ReturnType<typeof previewApprovalAction>>;

/** Uji matriks: "Jika PR seperti ini diajukan, siapa approvernya?" — tanpa menyimpan apa pun. */
export function ApprovalSimulator({ divisions, requesters }: { divisions: string[]; requesters: { nik: string; nama: string; divisiKode: string }[] }) {
  const [res, setRes] = useState<Res | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Simulator Matriks Approval</h2>
      <form
        className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => setRes(await previewApprovalAction(fd)));
        }}
      >
        <select name="jobLevel" className="input" required defaultValue="">
          <option value="" disabled>Job Level PR</option>
          {JOB_LEVELS.map((j) => <option key={j}>{j}</option>)}
        </select>
        <select name="divisiKode" className="input" required defaultValue="">
          <option value="" disabled>Divisi</option>
          {divisions.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select name="statusEmployment" className="input" defaultValue="Contract">
          {STATUS_EMPLOYMENT.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select name="jenisKebutuhan" className="input" defaultValue="Additional">
          {JENIS_KEBUTUHAN.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select name="requesterNik" className="input" defaultValue="">
          <option value="">Pemohon (opsional)</option>
          {requesters.map((r) => <option key={r.nik} value={r.nik}>{r.nama} ({r.divisiKode})</option>)}
        </select>
        <button className="btn btn-primary" disabled={pending}>{pending ? "…" : "Simulasikan"}</button>
      </form>
      {res && !res.ok && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{res.message}</p>}
      {res && res.ok && (
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="mb-2">Aturan terpilih: <b>{res.rule.nama}</b></div>
          <ol className="space-y-1">
            {res.steps.map((s) => (
              <li key={s.level} className={s.status === "DILEWATI" ? "text-slate-400 line-through" : ""}>
                Approval {s.level}: <b>{s.nama}</b> — {s.peran}
                {s.catatan && <span className="ml-1 text-xs no-underline">({s.catatan})</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
