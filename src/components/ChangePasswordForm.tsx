"use client";

import { useActionState } from "react";
import Link from "next/link";
import { changePassword } from "@/app/actions/auth";

export function ChangePasswordForm({ wajib }: { wajib: boolean }) {
  const [state, action, pending] = useActionState(changePassword, null);
  if (state?.ok)
    return (
      <div className="card space-y-3">
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{state.message}</p>
        <Link href="/" className="btn btn-primary w-full">Lanjut ke e-PR</Link>
      </div>
    );
  return (
    <form action={action} className="card space-y-4">
      {wajib && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Anda memakai password sementara. Buat password baru sebelum melanjutkan.</p>}
      <div>
        <label className="label" htmlFor="current">{wajib ? "Password sementara" : "Password saat ini"}</label>
        <input id="current" name="current" type="password" autoComplete="current-password" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="new">Password baru</label>
        <input id="new" name="new" type="password" autoComplete="new-password" className="input" required minLength={8} />
        <p className="hint">Minimal 8 karakter, mengandung huruf dan angka, tidak memuat NIK.</p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">Ulangi password baru</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" className="input" required />
      </div>
      {state && !state.ok && <p className="field-error" role="alert">{state.message}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Menyimpan…" : "Simpan Password"}</button>
    </form>
  );
}
