"use client";

import { useRef, useState, useTransition } from "react";
import { importEmployeesAction } from "@/app/actions/admin";
import type { ImportPreview } from "@/lib/employee-import";

type Res = Awaited<ReturnType<typeof importEmployeesAction>>;

export function ImportForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [res, setRes] = useState<Res | null>(null);
  const [pending, start] = useTransition();
  const run = (commit: boolean) => {
    const fd = new FormData(formRef.current!);
    fd.set("commit", commit ? "1" : "0");
    start(async () => setRes(await importEmployeesAction(fd)));
  };
  const preview: ImportPreview | undefined = res && "preview" in res ? res.preview : undefined;
  const committed = res?.ok && "committed" in res && res.committed;

  return (
    <div className="space-y-4">
      <form ref={formRef} className="card space-y-3" onSubmit={(e) => { e.preventDefault(); run(false); }} onChange={() => setRes(null)}>
        <div>
          <label className="label req" htmlFor="file">File Excel (.xlsx)</label>
          <input id="file" name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="input" required />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="createOrg" className="mt-1" />
          <span>Tambahkan divisi/departemen baru yang belum ada di master</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="deactivateMissing" className="mt-1" />
          <span>Nonaktifkan karyawan aktif yang <b>tidak ada</b> di file <span className="text-slate-500">(pakai hanya bila file berisi SELURUH karyawan)</span></span>
        </label>
        <button className="btn btn-secondary" disabled={pending}>{pending && !preview ? "Membaca…" : "1. Periksa File (pratinjau)"}</button>
      </form>

      {res && !res.ok && !preview && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{res.message}</p>}

      {preview && (
        <section className="card space-y-3">
          <h2 className="font-semibold">{committed ? "Impor selesai" : "Pratinjau impor"}</h2>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            {[
              ["Baris valid", preview.total],
              ["Karyawan baru", preview.baru],
              ["Data berubah", preview.diubah],
              ["Tidak berubah", preview.tetap],
              ["Akan dinonaktifkan", preview.akanDinonaktifkan],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">{k}</div><div className="text-xl font-bold tabular-nums">{v}</div></div>
            ))}
          </div>
          {(preview.divisiBaru.length > 0 || preview.departemenBaru.length > 0) && (
            <p className="text-sm">Divisi baru: {preview.divisiBaru.join(", ") || "—"} · Departemen baru: {preview.departemenBaru.join(", ")}</p>
          )}
          {preview.error.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-700">{preview.error.length} baris error (impor tidak bisa diproses)</h3>
              <ul className="max-h-60 overflow-y-auto text-sm text-red-700">
                {preview.error.map((e, i) => <li key={i}>Baris {e.baris}{e.nik && ` (NIK ${e.nik})`}: {e.pesan}</li>)}
              </ul>
            </div>
          )}
          {preview.peringatan.length > 0 && (
            <details className="text-sm text-amber-800">
              <summary className="cursor-pointer font-semibold">{preview.peringatan.length} peringatan (impor tetap bisa diproses)</summary>
              <ul className="max-h-60 overflow-y-auto">
                {preview.peringatan.map((e, i) => <li key={i}>Baris {e.baris} (NIK {e.nik}): {e.pesan}</li>)}
              </ul>
            </details>
          )}
          {committed ? (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              {res && "result" in res && res.result ? `${res.result.upserted} karyawan disimpan, ${res.result.deactivated} dinonaktifkan.` : ""}
            </p>
          ) : (
            <>
              {res && !res.ok && <p className="text-sm text-red-700">{res.message}</p>}
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending || preview.error.length > 0}
                onClick={() => {
                  if (preview.akanDinonaktifkan > 0 && !confirm(`${preview.akanDinonaktifkan} karyawan akan dinonaktifkan. Lanjutkan?`)) return;
                  run(true);
                }}
              >
                {pending ? "Memproses…" : "2. Proses Impor"}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
