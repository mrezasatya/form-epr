"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Result = { ok: true; message?: string; id?: string } | { ok: false; message: string };

/** Form admin generik: menjalankan server action, menampilkan hasil, opsional pindah halaman. */
export function AdminForm({
  action,
  children,
  className = "space-y-4",
  redirectTo,
  resetOnSuccess = false,
  submitLabel = "Simpan",
  inline = false,
}: {
  action: (fd: FormData) => Promise<Result>;
  children: React.ReactNode;
  className?: string;
  redirectTo?: (id: string | undefined) => string;
  resetOnSuccess?: boolean;
  submitLabel?: string;
  inline?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setMsg(null);
        start(async () => {
          const r = await action(fd);
          setMsg({ ok: r.ok, text: r.message ?? (r.ok ? "Tersimpan." : "Gagal.") });
          if (r.ok) {
            if (resetOnSuccess) form.reset();
            if (redirectTo) router.push(redirectTo(r.id));
            router.refresh();
          }
        });
      }}
    >
      {children}
      <div className={inline ? "flex items-center gap-2" : "flex flex-wrap items-center gap-3"}>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Menyimpan…" : submitLabel}</button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`} role="status">{msg.text}</span>}
      </div>
    </form>
  );
}

/** Tombol hapus dengan konfirmasi. */
export function DeleteButton({ action, confirmText, label = "Hapus" }: { action: () => Promise<Result>; confirmText: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
      onClick={() => {
        if (!confirm(confirmText)) return;
        start(async () => {
          const r = await action();
          if (!r.ok) alert(r.message);
          router.refresh();
        });
      }}
    >
      {label}
    </button>
  );
}
