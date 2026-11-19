# Panduan Deployment ke Jaringan Internal

Dokumen ini untuk tim IT. Aplikasi e-PR berjalan **sepenuhnya di dalam jaringan perusahaan** (on-premise):
tidak ada layanan cloud, CDN, atau font eksternal. Checklist go-live lengkap: [`GO-LIVE.md`](./GO-LIVE.md).

## 1. Arsitektur

```
Pengguna (browser/HP, jaringan kantor/VPN)
        │ HTTPS 443
        ▼
Reverse proxy (Nginx / IIS ARR)  ── sertifikat SSL internal, HSTS
        │ HTTP 3000 (lokal)
        ▼
Aplikasi e-PR (Node.js 22, Next.js standalone)
  ├─ worker latar: pengirim email (outbox) & pengingat approval
  ├─ folder file privat (memo, scan)  ── STORAGE_DIR
  ├─▶ PostgreSQL 16                    ── DATABASE_URL
  ├─▶ SMTP relay perusahaan (opsional) ── MAIL_MODE=smtp
  └─▶ Active Directory / LDAP ESS      ── AUTH_MODE=ldap (atau local)
```

## 2. Kebutuhan server (perkiraan untuk ±500 pengguna)

| Komponen | Minimum | Catatan |
|---|---|---|
| OS | Linux (Ubuntu 22.04/24.04, RHEL 8/9) dengan Docker; atau Windows Server + Node.js | Linux + Docker paling sederhana |
| CPU / RAM | 2 vCPU / 4 GB | Aplikasi + PostgreSQL di satu VM |
| Disk | 40 GB + ruang backup | Database + file memo/scan |
| Jaringan keluar | Hanya ke SMTP relay & server LDAP/AD internal | Tidak perlu internet saat berjalan |
| Jaringan masuk | 443 dari jaringan kantor (dan VPN bila pengguna di site) | Port 3000 cukup lokal |

## 3. Instalasi — Opsi A: Docker Compose (disarankan)

```bash
git clone <repo> /srv/e-pr && cd /srv/e-pr
cp .env.example .env      # lalu edit — lihat bagian 5
docker compose up -d --build
# Buat Admin HR pertama (mencetak password sementara bila AUTH_MODE=local):
docker compose run --rm migrate npx tsx scripts/create-admin.ts --nik <NIK> --nama "<Nama>" --divisi HRD --departemen HRD --email <email>
curl http://localhost:3000/api/health      # → {"status":"ok"}
```

- Service `migrate` menjalankan migrasi skema + seed master data (divisi, jurusan, sertifikasi, hari libur,
  matriks approval awal) lalu berhenti; `app` baru jalan setelahnya. Seed aman dijalankan ulang.
- Server tanpa internet saat build: build image di mesin lain → `docker save` → salin → `docker load`.
- PostgreSQL milik IT: hapus service `db` di `docker-compose.yml` dan arahkan `DATABASE_URL` ke server tersebut.

## 4. Instalasi — Opsi B: Node.js langsung (tanpa Docker)

```bash
npm ci
cp .env.example .env                     # DATABASE_URL ke PostgreSQL internal, SEED_DUMMY=false
npx prisma migrate deploy && npx prisma db seed
npx tsx scripts/create-admin.ts --nik <NIK> --nama "<Nama>"
npm run build
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
cd .next/standalone && node server.js    # jadikan service: systemd / PM2 / NSSM (Windows)
```
Service harus membaca `.env` (systemd: `EnvironmentFile=/srv/e-pr/.env`).

## 5. Konfigurasi `.env`

| Kelompok | Variabel | Production |
|---|---|---|
| Dasar | `APP_URL`, `SESSION_SECRET`, `COOKIE_SECURE` | `https://epr.perusahaan.local`, string acak 48+ karakter (`openssl rand -base64 48`), `true` |
| Data | `DATABASE_URL`, `POSTGRES_PASSWORD`, `STORAGE_DIR`, `SEED_DUMMY` | password kuat, folder di disk yang dibackup, **`false`** |
| Login | `AUTH_MODE` | `ldap` (disarankan) atau `local` — **jangan `dummy`** |
| Email | `MAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER/PASSWORD`, `SMTP_FROM` | sesuai relay internal |
| Worker | `REMINDER_BUSINESS_DAYS` (3), `REMINDER_ENABLED`, `JOBS_ENABLED` | default sudah sesuai spesifikasi |

Setelah instalasi, buka **Admin HR → Sistem & Audit**: panel "Kesiapan production" memeriksa konfigurasi di
atas dan menyediakan tombol **Kirim email uji**.

### 5.1 Login ke ESS / Active Directory (`AUTH_MODE=ldap`)

Password diverifikasi langsung ke AD/LDAP (bind) dan **tidak disimpan** di e-PR. NIK pengguna tetap harus ada di
master karyawan e-PR (diimpor dari HRIS) — itulah sumber divisi, jabatan, dan hak akses.

| Pola | Kapan dipakai | Variabel |
|---|---|---|
| A. Bind langsung | Username AD = NIK | `LDAP_URL`, `LDAP_USER_DN_TEMPLATE="{nik}@perusahaan.local"` |
| B. Cari lalu bind | Username AD ≠ NIK (NIK tersimpan di atribut mis. `employeeID`) | `LDAP_URL`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD` (akun layanan read-only), `LDAP_SEARCH_BASE`, `LDAP_SEARCH_FILTER="(employeeID={nik})"` |

Gunakan `ldaps://` (port 636), atau `ldap://` (389) dengan `LDAP_STARTTLS=true`, plus `LDAP_TLS_CA_FILE` berisi
sertifikat CA internal. **Jangan** memakai `ldap://` tanpa StartTLS di production (password terkirim tanpa enkripsi). Input NIK di-escape (RFC 4514/4515)
untuk mencegah LDAP injection. Bila server AD tidak dapat dihubungi, pengguna melihat pesan "server login tidak dapat
dihubungi" (bukan "password salah") dan error tercatat di audit log.

### 5.2 Login lokal (`AUTH_MODE=local`) — bila integrasi ESS belum siap

Password di-hash (bcrypt, cost 12). Admin HR membuat **password sementara** per karyawan (menu Admin HR → Karyawan),
yang wajib diganti saat login pertama. Kebijakan: ≥ 8 karakter, huruf + angka, tidak memuat NIK.

### 5.3 Keamanan login (kedua mode)
- Akun terkunci 15 menit setelah 5 kali gagal; Admin HR dapat membuka kunci dengan reset password.
- Ganti/reset password atau akun dinonaktifkan → semua sesi lama langsung tidak berlaku.
- Sesi berlaku 10 jam (satu shift); cookie `httpOnly`, `SameSite=Lax`, `Secure` bila `COOKIE_SECURE=true`.
- Pesan gagal login seragam (tidak membocorkan apakah NIK terdaftar). Semua login tercatat di audit log.

### 5.4 Email (`MAIL_MODE=smtp`)
Email ditulis ke tabel outbox dalam transaksi yang sama dengan aksinya, lalu dikirim worker setiap 30 detik.
Bila SMTP down, email dicoba ulang (jeda 5–20 menit, maks. 5x); kegagalan tampil di Admin HR → Sistem beserta
tombol "Kirim ulang". Pengingat approval tertunda (> 3 hari kerja) dikirim maksimal 1x per hari kerja mulai 08.00 WIB.
Worker aman berjalan di lebih dari satu instance (penguncian baris `SKIP LOCKED`).

## 6. Reverse proxy & HTTPS

```nginx
server {
  listen 443 ssl;
  server_name epr.perusahaan.local;
  ssl_certificate     /etc/ssl/epr.crt;
  ssl_certificate_key /etc/ssl/epr.key;
  add_header Strict-Transport-Security "max-age=31536000" always;
  client_max_body_size 6m;            # upload memo/scan/Excel maks. 5 MB
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;      # WAJIB: dipakai pemeriksaan CSRF server actions
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
Bila proxy tidak bisa meneruskan `Host` asli, isi `SERVER_ACTIONS_ALLOWED_ORIGINS=epr.perusahaan.local` **saat build**.
Aplikasi sudah mengirim header `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

## 7. Backup & pemulihan

```bash
# Harian (cron 01:15), retensi 30 hari, berisi dump DB + arsip folder file:
15 1 * * *  cd /srv/e-pr && MODE=docker ./scripts/backup.sh >> backup.log 2>&1
# Tanpa Docker:
MODE=native DATABASE_URL=postgresql://... STORAGE_DIR=/srv/epr/uploads ./scripts/backup.sh
# Pemulihan (meminta konfirmasi "YA"):
MODE=docker ./scripts/restore.sh backup/epr_db_<tgl>.dump backup/epr_files_<tgl>.tar.gz
```
Simpan salinan backup di lokasi lain (NAS/server berbeda). **Uji restore minimal sekali sebelum go-live.**

## 8. Operasional

| Kebutuhan | Cara |
|---|---|
| Cek kesehatan | `GET /api/health` (dipakai healthcheck Docker; bisa dipantau Zabbix/PRTG) |
| Log aplikasi | `docker compose logs -f app` (baris `[jobs]`, `[auth]`) |
| Pembaruan versi | `git pull && docker compose up -d --build` (migrasi otomatis) |
| Admin HR terkunci/lupa | `docker compose run --rm migrate npx tsx scripts/create-admin.ts --nik <NIK>` |
| Data master karyawan | Admin HR → Impor Karyawan (Excel ekspor HRIS, ada template) |

## 9. Privasi & UU PDP (ringkas)
- Data pribadi (nama, NIK, email, nama kandidat) hanya tersimpan di server internal; tidak ada pihak ketiga.
- Akses dibatasi peran di sisi server; file hanya bisa diunduh oleh pengguna yang berhak atas PR terkait.
- Audit trail: perubahan status PR, data rekrutmen, master data, konfigurasi, dan aktivitas login.
- Perlu ditetapkan bersama DPO/Legal: masa retensi data PR & kandidat, serta siapa yang boleh mengakses database.

## 10. Prototype online di Vercel (untuk demo & validasi, BUKAN production)

Dipakai agar HRD dan atasan bisa mencoba alur lewat link sebelum server internal siap. Data **dummy saja**.

| Item | Pengaturan Vercel |
|---|---|
| Database | Neon Postgres dari Vercel Marketplace (region Singapura), dihubungkan ke project → variabel `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_PRISMA_URL` terisi otomatis |
| Build | `vercel.json` → `scripts/vercel-build.sh` (migrasi + seed dummy + build) |
| Env | `AUTH_MODE=dummy`, `MAIL_MODE=log`, `SEED_DUMMY=true`, `JOBS_ENABLED=false`, `STORAGE_DIR=/tmp/epr-uploads`, `COOKIE_SECURE=true`, `SESSION_SECRET` acak |

Keterbatasan: file memo/scan hanya sementara (disk serverless tidak permanen), worker email & pengingat tidak berjalan,
dan siapa pun yang memegang link bisa masuk sebagai akun dummy mana pun. Jangan memasukkan data karyawan asli.
