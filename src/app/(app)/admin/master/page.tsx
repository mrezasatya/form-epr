import { prisma } from "@/lib/db";
import { addMasterAction, deleteMasterAction } from "@/app/actions/admin";
import { AdminForm, DeleteButton } from "@/components/admin/AdminForm";
import type { MasterKind } from "@/lib/admin-service";

export const metadata = { title: "Master Data · Admin HR" };

const JURUSAN_GROUP: Record<string, string> = { UMUM: "Umum", SMA_SMK: "SMA/SMK", PT: "Diploma/Sarjana/Pascasarjana" };

function Section({
  kind,
  title,
  items,
  groups,
  groupLabel = (g: string) => g,
  hint,
}: {
  kind: MasterKind;
  title: string;
  items: { id: number; nama: string; kelompok?: string }[];
  groups?: string[];
  groupLabel?: (g: string) => string;
  hint: string;
}) {
  const grouped = groups ? groups.map((g) => [g, items.filter((i) => i.kelompok === g)] as const) : [["", items] as const];
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-semibold">{title} <span className="font-normal text-slate-500">({items.length})</span></h2>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <AdminForm action={addMasterAction.bind(null, kind)} resetOnSuccess submitLabel="Tambah" className="flex flex-wrap items-end gap-2" inline>
        <input name="nama" placeholder="Nama baru" className="input min-w-[12rem] flex-1" required maxLength={150} />
        {groups && (
          <select name="kelompok" className="input w-auto" defaultValue={groups[groups.length - 1]}>
            {groups.map((g) => <option key={g} value={g}>{groupLabel(g)}</option>)}
          </select>
        )}
      </AdminForm>
      <div className="max-h-96 space-y-3 overflow-y-auto">
        {grouped.map(([g, list]) => (
          <div key={g}>
            {g && <div className="mb-1 text-xs font-semibold text-slate-500 uppercase">{groupLabel(g)}</div>}
            <ul className="flex flex-wrap gap-1.5">
              {list.map((i) => (
                <li key={i.id} className="chip">
                  {i.nama}
                  <DeleteButton action={deleteMasterAction.bind(null, kind, i.id)} confirmText={`Hapus "${i.nama}" dari daftar pilihan?`} label="×" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function MasterPage() {
  const [jurusan, sertifikasi, jabatan] = await Promise.all([
    prisma.masterJurusan.findMany({ orderBy: [{ urutan: "asc" }, { nama: "asc" }] }),
    prisma.masterSertifikasi.findMany({ orderBy: [{ urutan: "asc" }, { nama: "asc" }] }),
    prisma.masterJabatan.findMany({ orderBy: { nama: "asc" } }),
  ]);
  const sertGroups = Array.from(new Set(sertifikasi.map((s) => s.kelompok)));
  const hint = "Menghapus pilihan tidak mengubah PR yang sudah ada; pemohon tetap bisa mengetik manual.";
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Section kind="jurusan" title="Jurusan" items={jurusan} groups={["UMUM", "SMA_SMK", "PT"]} groupLabel={(g) => JURUSAN_GROUP[g] ?? g} hint={hint} />
      <Section kind="sertifikasi" title="Sertifikasi" items={sertifikasi} groups={sertGroups.length ? sertGroups : ["Lainnya"]} hint={hint} />
      <Section kind="jabatan" title="Daftar Jabatan Baku (saran Job Title)" items={jabatan} hint={hint} />
    </div>
  );
}
