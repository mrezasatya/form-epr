"use client";

import { useActionState } from "react";
import { loginPassword } from "@/app/actions/auth";

export function PasswordLoginForm({ next, mode }: { next: string; mode: "local" | "ldap" }) {
  const [state, action, pending] = useActionState(loginPassword, null);
  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="nik">NIK</label>
        <input id="nik" name="nik" autoComplete="username" inputMode="text" className="input" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="input" required />
        <p className="hint">
          {mode === "ldap" ? "Gunakan password akun ESS / komputer kantor Anda." : "Lupa password? Hubungi Admin HR untuk reset."}
        </p>
      </div>
      {state?.message && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{state.message}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Memeriksa…" : "Masuk"}</button>
    </form>
  );
}
