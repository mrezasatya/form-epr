"use client";

import { useState, useTransition } from "react";
import { resetPasswordAction } from "@/app/actions/admin";

export function ResetPasswordPanel({ nik, hasPassword, locked }: { nik: string; hasPassword: boolean; locked: boolean }) {
  const [pending, start] = useTransition();
  const [temp, setTemp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="card space-y-2 text-sm">
      <h3 className="font-semibold">Password login</h3>
      <p className="text-slate-600">
        Status: {hasPassword ? "sudah memiliki password" : "belum memiliki password (belum bisa login)"}
        {locked && <b className="text-red-600"> · akun sedang terkunci</b>}
      </p>
      {temp ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div>Password sementara (hanya ditampilkan sekali — sampaikan langsung ke karyawan):</div>
          <div className="my-1 font-mono text-lg font-bold tracking-wider select-all">{temp}</div>
          <div className="text-xs text-slate-600">Karyawan wajib mengganti password saat login pertama. Sesi lama otomatis berakhir.</div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => {
            if (!confirm("Buat password sementara baru? Password lama tidak berlaku lagi.")) return;
            start(async () => {
              const r = await resetPasswordAction(nik);
              if (r.ok && "tempPassword" in r && r.tempPassword) setTemp(r.tempPassword);
              else setError(r.message ?? "Gagal.");
            });
          }}
        >
          {hasPassword ? "Reset password / buka kunci" : "Buat password sementara"}
        </button>
      )}
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}
