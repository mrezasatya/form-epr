"use client";

import { useMemo, useState } from "react";
import type { Employee } from "@prisma/client";
import { EMPLOYEE_JOB_LEVELS, ROLES } from "@/lib/constants";
import { saveEmployeeAction } from "@/app/actions/admin";
import { AdminForm } from "./AdminForm";

const ROLE_OPTIONS: [string, string, string][] = [
  [ROLES.RECRUITER, "Rekruter", "Mengelola semua PR di Dashboard Rekruter"],
  [ROLES.ADMIN_HR, "Admin HR", "Mengelola master data & konfigurasi"],
  [ROLES.KEPALA_HRD, "Kepala HRD", "Approver peran \"Kepala HRD\" pada matriks"],
  [ROLES.DIREKTUR_UTAMA, "Direktur Utama", "Approver peran \"Direktur Utama\" pada matriks"],
];

export function EmployeeForm({
  employee,
  departments,
}: {
  employee: Employee | null;
  departments: { divisiKode: string; kode: string }[];
}) {
  const isNew = !employee;
  const divisions = useMemo(() => Array.from(new Set(departments.map((d) => d.divisiKode))).sort(), [departments]);
  const [divisi, setDivisi] = useState(employee?.divisiKode ?? "");
  const [dept, setDept] = useState(employee?.departemenKode ?? "");
  const depts = departments.filter((d) => d.divisiKode === divisi).map((d) => d.kode);

  return (
    <AdminForm
      action={saveEmployeeAction.bind(null, isNew)}
      redirectTo={(id) => `/admin/karyawan?saved=${encodeURIComponent(id ?? "")}`}
      className="card space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label req" htmlFor="nik">NIK</label>
          <input id="nik" name="nik" defaultValue={employee?.nik} readOnly={!isNew} className={`input ${!isNew ? "bg-slate-100" : ""}`} required />
        </div>
        <div>
          <label className="label req" htmlFor="nama">Nama</label>
          <input id="nama" name="nama" defaultValue={employee?.nama} maxLength={100} className="input" required />
        </div>
        <div>
          <label className="label req" htmlFor="jabatan">Jabatan</label>
          <input id="jabatan" name="jabatan" defaultValue={employee?.jabatan} maxLength={100} className="input" required />
        </div>
        <div>
          <label className="label req" htmlFor="jobLevel">Job Level</label>
          <select id="jobLevel" name="jobLevel" defaultValue={employee?.jobLevel ?? ""} className="input" required>
            <option value="">— Pilih —</option>
            {EMPLOYEE_JOB_LEVELS.map((j) => <option key={j}>{j}</option>)}
          </select>
        </div>
        <div>
          <label className="label req" htmlFor="divisiKode">Divisi</label>
          <select id="divisiKode" name="divisiKode" value={divisi} onChange={(e) => { setDivisi(e.target.value); setDept(""); }} className="input" required>
            <option value="">— Pilih —</option>
            {divisions.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label req" htmlFor="departemenKode">Departemen</label>
          <select id="departemenKode" name="departemenKode" value={dept} onChange={(e) => setDept(e.target.value)} className="input" required>
            <option value="">— Pilih —</option>
            {depts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={employee?.email ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="atasanNik">NIK Atasan</label>
          <input id="atasanNik" name="atasanNik" defaultValue={employee?.atasanNik ?? ""} className="input" />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Peran sistem</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLE_OPTIONS.map(([value, label, hint]) => (
            <label key={value} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm">
              <input type="checkbox" name="roles" value={value} defaultChecked={employee?.roles.includes(value)} className="mt-1" />
              <span><b>{label}</b><span className="block text-xs text-slate-500">{hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="label">Hak pemohon</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="isRequesterExtra" defaultChecked={employee?.isRequesterExtra} className="mt-1" />
          <span>Beri hak pemohon tambahan <span className="text-slate-500">(untuk Section Head / orang yang ditunjuk sebagai PM)</span></span>
        </label>
        {depts.length > 1 && (
          <div>
            <div className="mb-1 text-sm text-slate-600">Departemen tambahan yang boleh diajukan:</div>
            <div className="flex flex-wrap gap-2">
              {depts.filter((d) => d !== dept).map((d) => (
                <label key={d} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-sm">
                  <input type="checkbox" name="extraDepartments" value={d} defaultChecked={employee?.extraDepartments.includes(d)} />
                  {d}
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="aktif" defaultChecked={employee?.aktif ?? true} />
        Akun aktif <span className="text-slate-500">(nonaktif = tidak bisa login & tidak dipilih sebagai approver)</span>
      </label>
    </AdminForm>
  );
}
