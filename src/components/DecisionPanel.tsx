"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideAction } from "@/app/actions/pr";

export function DecisionPanel({ prId, level }: { prId: string; level: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"APPROVE" | "REJECT" | null>(null);
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!mode) return;
    if (mode === "REJECT" && !catatan.trim()) return setError("Alasan penolakan wajib diisi.");
    setError(null);
    start(async () => {
      const r = await decideAction(prId, mode, catatan);
      if (r.ok) {
        router.refresh();
      } else setError(r.message);
    });
  }

  return (
    <div className="card border-amber-300 bg-amber-50">
      <h2 className="font-semibold">Menunggu keputusan Anda (Approval {level})</h2>
      {!mode ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
          <button className="btn btn-success" onClick={() => setMode("APPROVE")}>
            Setujui
          </button>
          <button className="btn btn-danger" onClick={() => setMode("REJECT")}>
            Tolak
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <label className={`label ${mode === "REJECT" ? "req" : ""}`} htmlFor="catatan">
            {mode === "REJECT" ? "Alasan penolakan" : "Catatan (opsional)"}
          </label>
          <textarea
            id="catatan"
            className="input"
            rows={3}
            maxLength={500}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            autoFocus
          />
          {mode === "REJECT" && (
            <p className="hint">PR yang ditolak langsung ditutup. Pemohon dapat membuat PR baru (Duplikat PR).</p>
          )}
          {error && <p className="field-error">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button className="btn btn-secondary" disabled={pending} onClick={() => setMode(null)}>
              Batal
            </button>
            <button
              className={`btn ${mode === "APPROVE" ? "btn-success" : "btn-danger"}`}
              disabled={pending}
              onClick={submit}
            >
              {pending ? "Memproses…" : mode === "APPROVE" ? "Konfirmasi Setujui" : "Konfirmasi Tolak"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
