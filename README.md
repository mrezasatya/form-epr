# e-PR — Personnel Request

Web app untuk mengajukan, menyetujui, dan memantau permintaan tenaga kerja (e-PR).

- Spesifikasi fungsional: [`docs/SPEC_ePR.md`](docs/SPEC_ePR.md)
- Fase pengembangan & status: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Deployment ke server internal: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

**Stack:** Next.js 15 (App Router, TypeScript) · PostgreSQL 16 · Prisma · Tailwind CSS · Docker Compose.

## Menjalankan di komputer lokal (developer)

Prasyarat: Node.js 22, PostgreSQL 16 (atau Docker).

```bash
npm install
cp .env.example .env          # sesuaikan DATABASE_URL
npx prisma migrate deploy     # buat tabel
npx prisma db seed            # master data + akun dummy
npm run dev                   # http://localhost:3000
```

Atau seluruhnya dengan Docker: `docker compose up -d --build`.

## Akun dummy (prototype)

Halaman login menampilkan pilihan akun. Skenario uji yang disarankan:

| Langkah | Login sebagai | Aksi |
|---|---|---|
| 1 | Rudi Hartono (Dept Head WS A, divisi PRO) | Buat PR Operator → diajukan ke Kadiv PRO |
| 2 | Agus Prasetyo (Kadiv PRO) | Menu Approval → Setujui |
| 3 | Siti Rahmawati (Kadiv HRD / Kepala HRD) | Setujui → PR berstatus Disetujui / Open |
| 4 | Agus Prasetyo | Buat PR Section Head → Approval 1 dilewati otomatis (pemohon = Kadiv) |
| 5 | Adnan / Acha / Ami (Rekruter) | Lihat semua PR & log notifikasi |

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Mode pengembangan |
| `npm run build && npm start` | Build & jalankan production |
| `npm test` | Unit test (hari kerja, PR NO, matriks approval) |
| `npm run lint` / `npm run typecheck` | Pemeriksaan kode |
| `npm run db:migrate` | Buat migrasi baru setelah mengubah `prisma/schema.prisma` |
| `npm run db:reset` | Kosongkan & isi ulang database (hanya dev) |

## Struktur

```
prisma/            skema database, migrasi, seed master data
src/lib/           logika bisnis: approval.ts, prno.ts, dates.ts, pr-service.ts, pr-schema.ts
src/app/(app)/     halaman setelah login: beranda, pr, pr/baru, pr/[id], approval, notifikasi
src/app/login/     halaman login (mode dummy di prototype)
src/components/    komponen UI (PrForm, TagInput, ApprovalTimeline, ...)
tests/             unit test
```
