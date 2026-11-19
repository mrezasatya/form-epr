"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type R = { ok: true; message?: string } | { ok: false; message: string };

/** Menjalankan server action, menampilkan error, lalu me-refresh halaman bila sukses. */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  function run(fn: () => Promise<R>, okMessage?: string, onOk?: () => void) {
    setError(null);
    setSuccess(null);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setSuccess(okMessage ?? null);
        onOk?.();
        router.refresh();
      } else setError(r.message);
    });
  }
  return { pending, error, success, run, setError };
}
