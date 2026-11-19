import { ImportForm } from "@/components/admin/ImportForm";
import { IMPORT_COLUMNS } from "@/lib/employee-import";

export const metadata = { title: "Impor Karyawan · Admin HR" };

export default function ImportPage() {
  return (
    <div className="max-w-4xl space-y-3">
      <p className="text-sm text-slate-600">
        Perbarui master karyawan dari ekspor HRIS/ESS. Kolom: {IMPORT_COLUMNS.join(", ")}. NIK yang sudah ada akan diperbarui; peran sistem &
        hak pemohon tambahan tidak berubah. Seluruh baris diproses dalam satu transaksi — bila gagal, tidak ada data yang tersimpan.
      </p>
      <a href="/api/admin/template-karyawan" className="btn btn-secondary">⬇ Unduh template Excel</a>
      <ImportForm />
    </div>
  );
}
