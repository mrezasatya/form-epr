"use client";

import type { ApprovalRule } from "@prisma/client";
import { APPROVER_ROLES, JENIS_KEBUTUHAN, JOB_LEVELS, STATUS_EMPLOYMENT } from "@/lib/constants";
import { parseApprovers } from "@/lib/approval";
import { saveApprovalRuleAction } from "@/app/actions/admin";
import { AdminForm } from "./AdminForm";

export function RuleForm({
  rule,
  divisions,
  people,
}: {
  rule: ApprovalRule | null;
  divisions: string[];
  people: { nik: string; nama: string; jabatan: string }[];
}) {
  const ap = rule ? parseApprovers(rule.approvers) : [];
  const val = (i: number) => (ap[i] ? `${ap[i].type}:${ap[i].value}` : "");
  return (
    <AdminForm action={saveApprovalRuleAction.bind(null, rule?.id ?? null)} redirectTo={() => "/admin/approval"} className="card space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div>
          <label className="label req" htmlFor="nama">Nama aturan</label>
          <input id="nama" name="nama" defaultValue={rule?.nama} maxLength={100} className="input" required placeholder="mis. Staf PMO — Project" />
        </div>
        <div>
          <label className="label" htmlFor="prioritas">Prioritas</label>
          <input id="prioritas" name="prioritas" type="number" min={0} max={999} defaultValue={rule?.prioritas ?? 0} className="input" />
        </div>
      </div>
      <fieldset>
        <legend className="label req">Job Level</legend>
        <div className="flex flex-wrap gap-2">
          {JOB_LEVELS.map((j) => (
            <label key={j} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-sm">
              <input type="checkbox" name="jobLevels" value={j} defaultChecked={rule?.jobLevels.includes(j)} /> {j}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Divisi
          <select name="divisiKode" defaultValue={rule?.divisiKode ?? ""} className="input">
            <option value="">Semua divisi</option>
            {divisions.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="text-sm">Status of Employment
          <select name="statusEmployment" defaultValue={rule?.statusEmployment ?? ""} className="input">
            <option value="">Semua</option>
            {STATUS_EMPLOYMENT.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="text-sm">Jenis Kebutuhan
          <select name="jenisKebutuhan" defaultValue={rule?.jenisKebutuhan ?? ""} className="input">
            <option value="">Semua</option>
            {JENIS_KEBUTUHAN.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <label key={i} className="text-sm">
            <span className={i === 0 ? "req" : ""}>Approval {i + 1}</span>
            <select name={`approver${i + 1}`} defaultValue={val(i)} className="input" required={i === 0}>
              <option value="">{i === 0 ? "— Pilih —" : "— Tidak ada —"}</option>
              <optgroup label="Peran relatif">
                {Object.entries(APPROVER_ROLES).map(([k, v]) => <option key={k} value={`ROLE:${k}`}>{v}</option>)}
              </optgroup>
              <optgroup label="Orang tertentu">
                {people.map((p) => <option key={p.nik} value={`PERSON:${p.nik}`}>{p.nama} — {p.jabatan}</option>)}
              </optgroup>
            </select>
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="aktif" defaultChecked={rule?.aktif ?? true} /> Aturan aktif
      </label>
    </AdminForm>
  );
}
