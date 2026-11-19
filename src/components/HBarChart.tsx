/**
 * Bar horizontal satu seri (tanpa library eksternal — aman di jaringan internal).
 * Satu warna (identitas seri dijelaskan di judul), nilai ditulis dengan warna teks,
 * tooltip native via <title>, dan tabel data tersedia di bawahnya (aksesibilitas).
 */
export function HBarChart({
  data,
  unit,
  caption,
  decimals = 1,
}: {
  data: { key: string; value: number; n?: number }[];
  unit: string;
  caption: string;
  decimals?: number;
}) {
  if (!data.length) return <p className="text-sm text-slate-500">Belum ada data pada periode ini.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const fmt = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: decimals });
  return (
    <figure>
      <div className="space-y-1.5" role="img" aria-label={caption}>
        {data.map((d) => (
          <div key={d.key} className="group grid grid-cols-[7.5rem_1fr] items-center gap-2 text-sm" title={`${d.key}: ${fmt(d.value)} ${unit}${d.n !== undefined ? ` (n=${d.n})` : ""}`}>
            <div className="truncate text-slate-600">{d.key}</div>
            <div className="flex items-center gap-2">
              <div className="h-4 rounded-r-[4px] bg-brand-600 transition group-hover:bg-brand-800" style={{ width: `${Math.max(2, (d.value / max) * 85)}%` }} />
              <span className="shrink-0 text-xs text-slate-700 tabular-nums">
                {fmt(d.value)} {unit}
                {d.n !== undefined && <span className="text-slate-400"> · n={d.n}</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
      <details className="mt-2 text-xs text-slate-500">
        <summary className="cursor-pointer">Lihat tabel</summary>
        <table className="mt-1 w-full">
          <thead><tr className="text-left"><th>Kategori</th><th className="text-right">Nilai ({unit})</th>{data[0].n !== undefined && <th className="text-right">n</th>}</tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}><td>{d.key}</td><td className="text-right tabular-nums">{fmt(d.value)}</td>{d.n !== undefined && <td className="text-right">{d.n}</td>}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
