# e-PR — Personnel Request

Web app untuk mengajukan, menyetujui, dan memantau permintaan tenaga kerja (e-PR).

- Spesifikasi fungsional: [`docs/SPEC_ePR.md`](docs/SPEC_ePR.md)
- Fase pengembangan & status: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Deployment ke server internal: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- Checklist & pertanyaan go-live: [`docs/GO-LIVE.md`](docs/GO-LIVE.md)
- Dokumen rapat koordinasi IT: [`docs/RAPAT-IT.md`](docs/RAPAT-IT.md)

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
| 5 | Adnan (Rekruter) | Dashboard Rekruter → buka PR → isi Prioritas & PIC, tahap, kandidat |
| 6 | Rudi Hartono | PR Saya → lihat progres, klik status untuk timeline, Ajukan Hold (+memo) |
| 7 | Adnan | Eksekusi Hold → Unhold → kandidat Joined → Filled → Export Excel |
| 8 | Adnan | PR yang menunggu approval → Input Approval Kertas (+scan) · Cetak PR · menu Laporan |
| 9 | Nadia Kusuma (Admin HR) | Admin HR → matriks approval & simulator, divisi, karyawan, hari libur, master data |

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Mode pengembangan |
| `npm run build && npm start` | Build & jalankan production |
| `npm test` | Unit test (hari kerja, PR NO, matriks approval, rekrutmen, laporan) |
| `npm run test:integration` | Uji integrasi: email SMTP, pengingat, login LDAP (butuh DB dev + `bash tests/integration/slapd-setup.sh`) |
| `npm run admin:create -- --nik <NIK> --nama "<Nama>"` | Buat / pulihkan akun Admin HR |
| `./scripts/backup.sh` · `./scripts/restore.sh` | Backup & pemulihan (lihat DEPLOYMENT.md) |
| `npm run lint` / `npm run typecheck` | Pemeriksaan kode |
| `npm run db:migrate` | Buat migrasi baru setelah mengubah `prisma/schema.prisma` |
| `npm run db:reset` | Kosongkan & isi ulang database (hanya dev) |

## Struktur

```
prisma/            skema database, migrasi, seed master data
src/lib/           logika bisnis: approval.ts, prno.ts, dates.ts, pr-service.ts, pr-schema.ts,
                   recruitment.ts, recruitment-service.ts, recruiter-query.ts, storage.ts, reports.ts, admin-service.ts
src/app/(app)/     halaman setelah login: beranda, pr, pr/baru, pr/[id], approval, rekrutmen, laporan, admin/*, notifikasi
src/app/cetak/     halaman Cetak PR (A4, simpan sebagai PDF)
src/app/api/       health check, export Excel, unduh file memo (dengan cek hak akses)
src/app/login/     halaman login (mode dummy di prototype)
src/components/    komponen UI (PrForm, TagInput, ApprovalTimeline, ...)
tests/             unit test, tests/integration (SMTP, LDAP), tests/e2e (skrip Playwright)
scripts/           create-admin, backup, restore
```
