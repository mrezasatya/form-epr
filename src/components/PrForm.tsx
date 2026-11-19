"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LEAD_BUSINESS_DAYS,
  DURATION_CONTRACT,
  JENIS_KEBUTUHAN,
  JOB_LEVELS,
  LEVEL_PENDIDIKAN,
  LIMITS,
  LOKASI_KERJA,
  PENGALAMAN,
  SEMUA_JURUSAN,
  STATUS_EMPLOYMENT,
} from "@/lib/constants";
import { fmtDate } from "@/lib/dates";
import { validatePrForm, type FieldErrors, type PrFormInput } from "@/lib/pr-schema";
import { saveDraftAction, submitPrAction } from "@/app/actions/pr";
import { TagInput } from "./TagInput";

export type PrFormMasters = {
  departments: string[];
  jurusan: { nama: string; kelompok: string }[];
  sertifikasi: { nama: string; kelompok: string }[];
  jabatan: string[];
  employees: { nik: string; nama: string; jabatan: string; departemenKode: string }[];
  todayIso: string;
  defaultExpectedIso: string;
};

type Props = {
  initial: PrFormInput;
  masters: PrFormMasters;
  profile: { nama: string; divisiKode: string };
  draftId?: string;
  sourcePrNo?: string | null;
};

export function PrForm({ initial, masters, profile, draftId, sourcePrNo }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<PrFormInput>(() => ({
    ...initial,
    expectedDate: initial.expectedDateManual && initial.expectedDate ? initial.expectedDate : masters.defaultExpectedIso,
  }));
  const [touched, setTouched] = useState<Partial<Record<keyof PrFormInput, boolean>>>({});
  const [showAll, setShowAll] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const errors = useMemo(() => validatePrForm(form, masters.todayIso), [form, masters.todayIso]);
  const isValid = Object.keys(errors).length === 0;

  const set = <K extends keyof PrFormInput>(key: K, value: PrFormInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors((e) => ({ ...e, [key]: undefined }));
  };
  const touch = (key: keyof PrFormInput) => setTouched((t) => ({ ...t, [key]: true }));
  const err = (key: keyof PrFormInput) => serverErrors[key] ?? (touched[key] || showAll ? errors[key] : undefined);

  const jurusanOptions = useMemo(() => {
    const g = form.levelPendidikan === "SMA/SMK" ? ["UMUM", "SMA_SMK"] : form.levelPendidikan ? ["UMUM", "PT"] : null;
    return masters.jurusan.filter((j) => !g || g.includes(j.kelompok)).map((j) => j.nama);
  }, [form.levelPendidikan, masters.jurusan]);

  const employeeByName = useMemo(() => new Map(masters.employees.map((e) => [e.nama, e])), [masters.employees]);

  function run(kind: "draft" | "submit") {
    setMessage(null);
    startTransition(async () => {
      const action = kind === "draft" ? saveDraftAction : submitPrAction;
      const r = await action(form, draftId);
      if (r.ok) {
        router.push(kind === "draft" ? `/pr?draft=${r.id}` : `/pr/${r.id}?baru=1`);
        router.refresh();
      } else {
        setConfirming(false);
        setServerErrors(r.errors ?? {});
        setShowAll(true);
        setMessage({ type: "error", text: r.message ?? "Gagal menyimpan." });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const select = (k: keyof PrFormInput, options: readonly string[], placeholder = "— Pilih —") => (
    <select
      id={k}
      className={`input ${err(k) ? "input-error" : ""}`}
      value={form[k] as string}
      onChange={(e) => set(k, e.target.value as never)}
      onBlur={() => touch(k)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setShowAll(true);
        if (isValid) setConfirming(true);
      }}
      className="space-y-5"
    >
      {sourcePrNo && (
        <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
          Form diisi dari PR <b>{sourcePrNo}</b>. Periksa dan sesuaikan sebelum mengajukan.
        </div>
      )}
      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
          {message.text}
        </div>
      )}

      {/* A. Posisi */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-800">A. Posisi</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Divisi</label>
            <input className="input" value={profile.divisiKode} disabled />
          </div>
          <Field k="departemenKode" error={err("departemenKode")} label="Departemen">
            {masters.departments.length > 1 ? (
              select("departemenKode", masters.departments)
            ) : (
              <input id="departemenKode" className="input" value={form.departemenKode} disabled />
            )}
          </Field>
        </div>
        <Field k="jobTitle" error={err("jobTitle")} label="Job Title" hint="Pilih dari saran atau ketik bebas">
          <input
            id="jobTitle"
            list="jabatan-list"
            maxLength={LIMITS.jobTitle}
            className={`input ${err("jobTitle") ? "input-error" : ""}`}
            value={form.jobTitle}
            onChange={(e) => set("jobTitle", e.target.value)}
            onBlur={() => touch("jobTitle")}
            placeholder="mis. Welder"
          />
          <datalist id="jabatan-list">
            {masters.jabatan.map((j) => (
              <option key={j} value={j} />
            ))}
          </datalist>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field k="jobLevel" error={err("jobLevel")} label="Job Level">
            {select("jobLevel", JOB_LEVELS)}
          </Field>
          <Field k="lokasiKerja" error={err("lokasiKerja")} label="Lokasi Kerja">
            {select("lokasiKerja", LOKASI_KERJA)}
          </Field>
        </div>
        <Field k="jobResponsibilities" error={err("jobResponsibilities")} label="Job Responsibilities">
          <textarea
            id="jobResponsibilities"
            rows={4}
            maxLength={LIMITS.jobResponsibilities}
            className={`input ${err("jobResponsibilities") ? "input-error" : ""}`}
            value={form.jobResponsibilities}
            onChange={(e) => set("jobResponsibilities", e.target.value)}
            onBlur={() => touch("jobResponsibilities")}
          />
          <div className="mt-1 text-right text-xs text-slate-500">
            {form.jobResponsibilities.length}/{LIMITS.jobResponsibilities}
          </div>
        </Field>
      </section>

      {/* B. Kualifikasi */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-800">B. Kualifikasi</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field k="levelPendidikan" error={err("levelPendidikan")} label="Level Pendidikan">
            {select("levelPendidikan", LEVEL_PENDIDIKAN)}
          </Field>
          <Field k="pengalaman" error={err("pengalaman")} label="Pengalaman">
            {select("pengalaman", PENGALAMAN)}
          </Field>
        </div>
        <Field k="jurusan" error={err("jurusan")} label="Jurusan" hint={`Boleh lebih dari 1. Pilih "${SEMUA_JURUSAN}" bila tidak dibatasi.`}>
          <TagInput
            id="jurusan"
            value={form.jurusan}
            suggestions={jurusanOptions}
            invalid={!!err("jurusan")}
            placeholder="Ketik atau pilih jurusan"
            splitOnComma={false}
            onBlur={() => touch("jurusan")}
            onChange={(v) => {
              const last = v[v.length - 1];
              set("jurusan", last === SEMUA_JURUSAN ? [SEMUA_JURUSAN] : v.filter((x) => x !== SEMUA_JURUSAN));
            }}
          />
        </Field>
        <Field k="hardSkills" error={err("hardSkills")} label="Hard Skill" hint="Pisahkan dengan koma atau Enter, mis. PLC, SCADA, Python">
          <TagInput
            id="hardSkills"
            value={form.hardSkills}
            invalid={!!err("hardSkills")}
            onBlur={() => touch("hardSkills")}
            onChange={(v) => set("hardSkills", v)}
          />
        </Field>
        <Field k="softSkills" error={err("softSkills")} label="Soft Skill" hint="Pisahkan dengan koma atau Enter, mis. Komunikasi, Teamwork">
          <TagInput
            id="softSkills"
            value={form.softSkills}
            invalid={!!err("softSkills")}
            onBlur={() => touch("softSkills")}
            onChange={(v) => set("softSkills", v)}
          />
        </Field>
        <Field k="sertifikasiWajib" error={err("sertifikasiWajib")} label="Sertifikasi Wajib">
          <div className="flex gap-2" id="sertifikasiWajib">
            {(["Ya", "Tidak"] as const).map((o) => (
              <button
                type="button"
                key={o}
                onClick={() => {
                  set("sertifikasiWajib", o);
                  touch("sertifikasiWajib");
                }}
                className={`btn flex-1 sm:flex-none sm:px-8 ${form.sertifikasiWajib === o ? "btn-primary" : "btn-secondary"}`}
              >
                {o}
              </button>
            ))}
          </div>
        </Field>
        {form.sertifikasiWajib === "Ya" && (
          <Field k="sertifikasi" error={err("sertifikasi")} label="Nama Sertifikat" hint="Pilih dari daftar atau ketik manual; boleh lebih dari 1">
            <TagInput
              id="sertifikasi"
              value={form.sertifikasi}
              suggestions={masters.sertifikasi.map((s) => s.nama)}
              invalid={!!err("sertifikasi")}
              splitOnComma={false}
              placeholder="mis. Welder (SMAW/GTAW/FCAW – ASME/AWS/BNSP)"
              onBlur={() => touch("sertifikasi")}
              onChange={(v) => set("sertifikasi", v)}
            />
          </Field>
        )}
      </section>

      {/* C. Kontrak & Kebutuhan */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-800">C. Kontrak & Kebutuhan</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field k="statusEmployment" error={err("statusEmployment")} label="Status of Employment">
            {select("statusEmployment", STATUS_EMPLOYMENT)}
          </Field>
          <Field k="durationContract" error={err("durationContract")} label="Duration of Contract">
            {select("durationContract", DURATION_CONTRACT)}
          </Field>
        </div>
        {form.durationContract === "Others" && (
          <Field k="durationOthers" error={err("durationOthers")} label="Durasi Kontrak (Others)">
            <input
              id="durationOthers"
              maxLength={50}
              className={`input ${err("durationOthers") ? "input-error" : ""}`}
              value={form.durationOthers}
              onChange={(e) => set("durationOthers", e.target.value)}
              onBlur={() => touch("durationOthers")}
              placeholder="mis. Sampai proyek selesai (±18 bulan)"
            />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field k="kebutuhan" error={err("kebutuhan")} label="Kebutuhan (orang)">
            <input
              id="kebutuhan"
              inputMode="numeric"
              className={`input ${err("kebutuhan") ? "input-error" : ""}`}
              value={form.kebutuhan}
              onChange={(e) => set("kebutuhan", e.target.value.replace(/\D/g, "").slice(0, 2))}
              onBlur={() => touch("kebutuhan")}
            />
          </Field>
          <Field k="jenisKebutuhan" error={err("jenisKebutuhan")} label="Jenis Kebutuhan">
            {select("jenisKebutuhan", JENIS_KEBUTUHAN)}
          </Field>
        </div>
        {form.jenisKebutuhan === "Replacement" && (
          <Field k="replaced" error={err("replaced")}
            label="Nama Karyawan yang Digantikan"
            hint={`Cari nama karyawan di divisi Anda atau ketik manual. Maksimal ${form.kebutuhan || 1} nama.`}
          >
            <TagInput
              id="replaced"
              value={form.replaced.map((r) => r.nama)}
              suggestions={masters.employees.map((e) => e.nama)}
              invalid={!!err("replaced")}
              splitOnComma={false}
              max={Number(form.kebutuhan) || 1}
              onBlur={() => touch("replaced")}
              onChange={(names) =>
                set(
                  "replaced",
                  names.map((nama) => ({ nama, nik: employeeByName.get(nama)?.nik ?? null })),
                )
              }
            />
          </Field>
        )}
      </section>

      {/* D. Timeline */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-800">D. Timeline & Catatan</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Hiring Manager</label>
            <input className="input" value={profile.nama} disabled />
          </div>
          <div>
            <label className="label">Tanggal Pengajuan</label>
            <input className="input" value={`${fmtDate(masters.todayIso)} (saat diajukan)`} disabled />
          </div>
          <Field k="expectedDate" error={err("expectedDate")}
            label="Expected Date"
            required={false}
            hint={
              form.expectedDateManual ? (
                <button
                  type="button"
                  className="text-brand-700 underline"
                  onClick={() => setForm((f) => ({ ...f, expectedDate: masters.defaultExpectedIso, expectedDateManual: false }))}
                >
                  {fmtDate(form.expectedDate)} · kembalikan ke default ({fmtDate(masters.defaultExpectedIso)})
                </button>
              ) : (
                `${fmtDate(form.expectedDate)} — default: Tanggal Pengajuan + ${DEFAULT_LEAD_BUSINESS_DAYS} hari kerja`
              )
            }
          >
            <input
              id="expectedDate"
              type="date"
              min={masters.todayIso}
              className={`input ${err("expectedDate") ? "input-error" : ""}`}
              value={form.expectedDate}
              onChange={(e) => setForm((f) => ({ ...f, expectedDate: e.target.value, expectedDateManual: true }))}
              onBlur={() => touch("expectedDate")}
            />
          </Field>
        </div>
        <Field k="remarks" error={err("remarks")} label="Catatan (Remarks)" required={false}>
          <textarea
            id="remarks"
            rows={3}
            maxLength={LIMITS.remarks}
            className={`input ${err("remarks") ? "input-error" : ""}`}
            value={form.remarks}
            onChange={(e) => set("remarks", e.target.value)}
          />
          <div className="mt-1 text-right text-xs text-slate-500">
            {form.remarks.length}/{LIMITS.remarks}
          </div>
        </Field>
      </section>

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:mx-0 sm:flex-row sm:justify-end sm:rounded-xl sm:border">
        {!isValid && showAll && (
          <p className="text-sm text-red-600 sm:mr-auto sm:self-center">
            Masih ada {Object.keys(errors).length} isian yang perlu dilengkapi.
          </p>
        )}
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run("draft")}>
          Simpan Draft
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending || (showAll && !isValid)}>
          Lanjut: Tinjau & Ajukan
        </button>
      </div>

      {confirming && (
        <ConfirmDialog form={form} profile={profile} pending={pending} onCancel={() => setConfirming(false)} onConfirm={() => run("submit")} />
      )}
    </form>
  );
}

function Field({
  k,
  label,
  error,
  required = true,
  hint,
  children,
}: {
  k: keyof PrFormInput;
  label: string;
  error?: string;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={k} className={`label ${required ? "req" : ""}`}>
        {label}
      </label>
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

function ConfirmDialog({
  form,
  profile,
  pending,
  onCancel,
  onConfirm,
}: {
  form: PrFormInput;
  profile: { nama: string; divisiKode: string };
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const rows: [string, React.ReactNode][] = [
    ["Divisi / Departemen", `${profile.divisiKode} / ${form.departemenKode}`],
    ["Job Title", form.jobTitle],
    ["Job Level", form.jobLevel],
    ["Job Responsibilities", <span key="jr" className="whitespace-pre-line">{form.jobResponsibilities}</span>],
    ["Lokasi Kerja", form.lokasiKerja],
    ["Pendidikan", `${form.levelPendidikan} — ${form.jurusan.join(", ")}`],
    ["Pengalaman", form.pengalaman],
    ["Hard Skill", form.hardSkills.join(", ")],
    ["Soft Skill", form.softSkills.join(", ")],
    ["Sertifikasi Wajib", form.sertifikasiWajib === "Ya" ? form.sertifikasi.join(", ") : "Tidak"],
    ["Status / Durasi", `${form.statusEmployment} — ${form.durationContract === "Others" ? form.durationOthers : form.durationContract}`],
    ["Kebutuhan", `${form.kebutuhan} orang (${form.jenisKebutuhan})`],
    ...(form.jenisKebutuhan === "Replacement"
      ? ([["Menggantikan", form.replaced.map((r) => r.nama).join(", ")]] as [string, string][])
      : []),
    ["Expected Date", fmtDate(form.expectedDate)],
    ["Catatan", form.remarks || "—"],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-2xl sm:rounded-2xl">
        <h2 className="text-lg font-bold">Konfirmasi Pengajuan PR</h2>
        <p className="mb-4 text-sm text-slate-500">
          Setelah diajukan, PR tidak bisa diedit dan akan dikirim ke approver pertama.
        </p>
        <dl className="divide-y divide-slate-100 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-3 py-2">
              <dt className="text-slate-500">{k}</dt>
              <dd className="col-span-2 font-medium break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={pending}>
            Kembali & Ubah
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={pending}>
            {pending ? "Mengajukan…" : "Ya, Ajukan PR"}
          </button>
        </div>
      </div>
    </div>
  );
}
