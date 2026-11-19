import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDate, todayWib, toIsoDate } from "@/lib/dates";
import { deleteHolidayAction, upsertHolidaysAction } from "@/app/actions/admin";
import { AdminForm, DeleteButton } from "@/components/admin/AdminForm";

export const metadata = { title: "Hari Libur · Admin HR" };

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default async function HolidaysPage({ searchParams }: { searchParams: Promise<{ tahun?: string }> }) {
  const thisYear = todayWib().getUTCFullYear();
  const tahun = Number((await searchParams).tahun) || thisYear;
  const [rows, years] = await Promise.all([
    prisma.holiday.findMany({
      where: { tanggal: { gte: new Date(Date.UTC(tahun, 0, 1)), lte: new Date(Date.UTC(tahun, 11, 31)) } },
      orderBy: { tanggal: "asc" },
    }),
    prisma.$queryRaw<{ y: number }[]>`SELECT DISTINCT EXTRACT(YEAR FROM tanggal)::int AS y FROM "Holiday" ORDER BY y`,
  ]);
  const yearList = Array.from(new Set([...years.map((y) => y.y), thisYear, thisYear + 1])).sort();
  const weekday = rows.filter((r) => ![0, 6].includes(r.tanggal.getUTCDay())).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Hari libur & cuti bersama {tahun}</h2>
          <div className="flex gap-1">
            {yearList.map((y) => (
              <Link key={y} href={`/admin/libur?tahun=${y}`} className={`rounded-full px-3 py-1 text-sm ${y === tahun ? "bg-brand-600 text-white" : "bg-slate-100"}`}>{y}</Link>
            ))}
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Belum ada data libur {tahun}. Expected Date & Target Start Date yang melewati tahun ini akan dihitung tanpa libur nasional.
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">{rows.length} tanggal · {weekday} jatuh pada hari kerja (mengurangi hitungan hari kerja).</p>
            <ul className="divide-y divide-slate-100 text-sm">
              {rows.map((r) => (
                <li key={r.tanggal.toISOString()} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <span className="font-medium tabular-nums">{fmtDate(r.tanggal)}</span>
                    <span className="ml-2 text-slate-500">{HARI[r.tanggal.getUTCDay()]}</span>
                    <div className="text-slate-700">{r.keterangan}</div>
                  </div>
                  <DeleteButton action={deleteHolidayAction.bind(null, toIsoDate(r.tanggal))} confirmText={`Hapus ${fmtDate(r.tanggal)} (${r.keterangan})?`} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="card h-fit space-y-2">
        <h2 className="font-semibold">Tambah / perbarui</h2>
        <p className="text-xs text-slate-500">
          Satu baris per tanggal: <code>DD/MM/YYYY;Keterangan</code>. Bisa tempel langsung dari Excel (kolom tanggal & keterangan).
          Tanggal yang sudah ada akan diperbarui keterangannya. Sumber resmi: SKB 3 Menteri.
        </p>
        <AdminForm action={upsertHolidaysAction} resetOnSuccess>
          <textarea name="baris" rows={8} className="input font-mono text-sm" placeholder={"01/01/2027;Tahun Baru Masehi\n17/08/2027;Hari Kemerdekaan RI"} required />
        </AdminForm>
      </section>
    </div>
  );
}
