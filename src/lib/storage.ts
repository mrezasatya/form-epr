import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Penyimpanan file memo/scan di disk server (folder privat, bukan folder publik).
 * Lokasi diatur lewat STORAGE_DIR (default ./uploads). Di Docker dipetakan ke volume "epr-uploads".
 * File hanya bisa diunduh lewat /api/files/... yang memeriksa hak akses PR.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const TYPES = {
  pdf: { mime: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  jpg: { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
} as const;
type Ext = keyof typeof TYPES;

function storageDir() {
  return path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "uploads"));
}

/** Validasi isi file (bukan sekadar ekstensi) agar file berbahaya tidak lolos. */
function detect(buf: Buffer): Ext | null {
  for (const [ext, t] of Object.entries(TYPES) as [Ext, (typeof TYPES)[Ext]][])
    if (t.magic.every((b, i) => buf[i] === b)) return ext;
  return null;
}

export type UploadResult = { ok: true; key: string } | { ok: false; message: string };

/** Simpan file; mengembalikan key "prId/uuid.ext". File kosong / tidak ada → ok tanpa key. */
export async function saveMemo(prId: string, file: File | null): Promise<UploadResult | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "Ukuran file maksimal 5 MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = detect(buf);
  if (!ext) return { ok: false, message: "Format file harus PDF atau JPG." };
  if (!/^[a-z0-9]+$/i.test(prId)) return { ok: false, message: "PR tidak valid." };
  const dir = path.join(storageDir(), prId);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), buf, { mode: 0o640 });
  return { ok: true, key: `${prId}/${name}` };
}

export async function readMemo(key: string): Promise<{ data: Buffer; mime: string } | null> {
  const m = /^([a-z0-9]+)\/([0-9a-f-]{36})\.(pdf|jpg)$/i.exec(key);
  if (!m) return null;
  try {
    const data = await readFile(path.join(storageDir(), m[1], `${m[2]}.${m[3]}`));
    return { data, mime: TYPES[m[3].toLowerCase() as Ext].mime };
  } catch {
    return null;
  }
}

export function memoPrId(key: string): string | null {
  return /^([a-z0-9]+)\//i.exec(key)?.[1] ?? null;
}
