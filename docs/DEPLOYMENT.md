# Panduan Deployment ke Jaringan Internal

Dokumen ini untuk tim IT. Aplikasi e-PR dirancang agar bisa berjalan **sepenuhnya di dalam jaringan
perusahaan** (on-premise) tanpa bergantung layanan cloud.

## 1. Kebutuhan server (perkiraan untuk ±500 pengguna)

| Komponen | Minimum | Catatan |
|---|---|---|
| OS | Linux (Ubuntu 22.04/24.04, RHEL 8/9) atau Windows Server dengan Docker | Linux lebih disarankan |
| CPU / RAM | 2 vCPU / 4 GB | Aplikasi + PostgreSQL di satu VM |
| Disk | 40 GB | Database + file memo/scan (Fase 2–3) |
| Software | Docker Engine + Docker Compose **atau** Node.js 22 LTS + PostgreSQL 16 | |
| Jaringan | Port 80/443 di jaringan internal; nama DNS internal mis. `epr.perusahaan.local` | Tidak perlu akses internet saat berjalan |

## 2. Opsi A — Docker Compose (disarankan)

```bash
git clone <repo> e-pr && cd e-pr
cp .env.example .env
# Edit .env: SESSION_SECRET (openssl rand -base64 48), APP_URL, POSTGRES_PASSWORD, SEED_DUMMY=false
docker compose up -d --build
```

- Service `migrate` menjalankan migrasi skema dan seed master data (divisi, jurusan, sertifikasi, hari libur,
  matriks approval awal) lalu berhenti. Service `app` baru jalan setelah migrasi sukses.
- Cek kesehatan: `curl http://localhost:3000/api/health` → `{"status":"ok"}`.
- Bila server tidak punya akses internet saat build: build image di mesin lain, lalu
  `docker save` → salin → `docker load`.

## 3. Opsi B — Node.js langsung (tanpa Docker)

```bash
npm ci
cp .env.example .env            # sesuaikan DATABASE_URL ke PostgreSQL internal
npx prisma migrate deploy       # buat/ubah tabel
SEED_DUMMY=false npx prisma db seed
npm run build
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
node .next/standalone/server.js # jalankan sebagai service (systemd / PM2 / NSSM di Windows)
```

## 4. Reverse proxy & HTTPS

Letakkan Nginx / IIS (ARR) / Apache di depan aplikasi untuk HTTPS dengan sertifikat internal perusahaan,
lalu set `COOKIE_SECURE=true` dan `APP_URL=https://epr.perusahaan.local` di `.env`.

```nginx
server {
  listen 443 ssl;
  server_name epr.perusahaan.local;
  client_max_body_size 6m;            # upload memo maks. 5 MB
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host;
               proxy_set_header X-Forwarded-Proto $scheme; }
}
```

## 5. Konfigurasi yang bergantung pada keputusan IT (Fase 4)

| Variabel | Prototype | Production |
|---|---|---|
| `AUTH_MODE` | `dummy` (pilih akun) | `ldap` (verifikasi ke ESS/Active Directory) atau `local` (password di-hash) |
| `MAIL_MODE` | `log` (tampil di menu Notifikasi) | `smtp` (relay SMTP internal) |
| `SEED_DUMMY` | `true` | **`false`** — master karyawan diimpor dari HRIS/ESS |
| `COOKIE_SECURE` | — | `true` (wajib bila memakai HTTPS) |

Informasi yang dibutuhkan dari IT untuk Fase 4: metode autentikasi ESS (LDAP/AD host & base DN, API, atau SSO
SAML/OIDC), host relay SMTP + alamat pengirim, format ekspor master karyawan, serta kebijakan backup.

## 6. Backup & pemulihan

```bash
# Backup harian (cron), simpan minimal 30 hari di lokasi terpisah
docker compose exec -T db pg_dump -U epr -Fc epr > backup/epr_$(date +%F).dump
# Pemulihan
docker compose exec -T db pg_restore -U epr -d epr --clean < backup/epr_YYYY-MM-DD.dump
```
Volume `epr-uploads` (file memo/scan) juga harus ikut dibackup.

## 7. Pembaruan versi

```bash
git pull && docker compose up -d --build   # migrasi baru otomatis dijalankan service "migrate"
```

## 8. Keamanan & UU PDP (ringkas)

- Data pribadi (nama, NIK, email) hanya tersimpan di server internal; tidak ada layanan pihak ketiga.
- Akses dibatasi berdasarkan peran di sisi server (bukan hanya disembunyikan di tampilan).
- Setiap perubahan status tercatat (siapa, kapan) di tabel `PrStatusHistory`.
- Tetapkan masa retensi data PR dan siapa yang berwenang mengakses database bersama DPO / Legal.
