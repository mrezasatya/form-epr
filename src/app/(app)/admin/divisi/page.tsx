import { prisma } from "@/lib/db";
import { saveDivisionAction } from "@/app/actions/admin";
import { AdminForm } from "@/components/admin/AdminForm";

export const metadata = { title: "Divisi · Admin HR" };

export default async function DivisionsPage() {
  const [divisions, leaders] = await Promise.all([
    prisma.division.findMany({ orderBy: { kode: "asc" }, include: { departments: { orderBy: { kode: "asc" } } } }),
    prisma.employee.findMany({
      where: { aktif: true, jobLevel: { in: ["Division Head", "Director"] } },
      orderBy: { nama: "asc" },
      select: { nik: true, nama: true, jobLevel: true, divisiKode: true },
    }),
  ]);
  const directors = leaders.filter((l) => l.jobLevel === "Director");
  const missing = divisions.filter((d) => !d.kadivNik || !d.direkturPembinaNik).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Kadiv dan Direktur pembina dipakai oleh matriks approval (peran &quot;Kadiv divisi pemohon&quot; & &quot;Direktur pembina divisi&quot;)
        dan untuk akses Kadiv ke PR divisinya.
        {missing > 0 && <b className="text-red-600"> {missing} divisi belum lengkap — PR dari divisi tersebut akan gagal diajukan bila matriks membutuhkannya.</b>}
      </p>
      <div className="space-y-2">
        {divisions.map((d) => (
          <AdminForm key={d.kode} action={saveDivisionAction} className="card grid items-end gap-3 p-3 md:grid-cols-[10rem_1fr_1fr_auto]" inline>
            <input type="hidden" name="kode" value={d.kode} />
            <div>
              <div className="font-semibold">{d.kode}</div>
              <div className="text-xs text-slate-500">{d.departments.map((x) => x.kode).join(", ")}</div>
            </div>
            <label className="text-xs text-slate-500">Kepala Divisi
              <select name="kadivNik" defaultValue={d.kadivNik ?? ""} className={`input ${!d.kadivNik ? "input-error" : ""}`}>
                <option value="">— Belum diatur —</option>
                {leaders.map((l) => <option key={l.nik} value={l.nik}>{l.nama} ({l.jobLevel}, {l.divisiKode})</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-500">Direktur Pembina
              <select name="direkturPembinaNik" defaultValue={d.direkturPembinaNik ?? ""} className={`input ${!d.direkturPembinaNik ? "input-error" : ""}`}>
                <option value="">— Belum diatur —</option>
                {directors.map((l) => <option key={l.nik} value={l.nik}>{l.nama}</option>)}
              </select>
            </label>
          </AdminForm>
        ))}
      </div>
    </div>
  );
}
