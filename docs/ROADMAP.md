# Roadmap Pengembangan e-PR

Acuan fungsional: [`SPEC_ePR.md`](./SPEC_ePR.md). Dokumen ini membagi pengembangan menjadi fase yang
masing-masing menghasilkan sesuatu yang bisa dicoba dan divalidasi.

## Prinsip arsitektur: "siap pindah ke jaringan internal"

Sejak fase pertama, aplikasi dibangun supaya bisa dipindahkan ke server internal perusahaan
**tanpa menulis ulang kode**. Yang berubah hanya konfigurasi (`.env`).

| Keputusan | Alasan |
|---|---|
| **Next.js (Node.js) + PostgreSQL**, dikemas sebagai **Docker Compose** | Berjalan sama persis di laptop, cloud, maupun server internal (Linux/VM). Tidak bergantung layanan cloud tertentu |
| **PostgreSQL sejak prototype** (bukan SQLite / database cloud) | Tidak perlu migrasi data/skema saat pindah ke production; IT cukup menyediakan server PostgreSQL atau memakai container |
| **Tanpa font/CDN eksternal** | Aplikasi tetap tampil normal di jaringan yang tidak punya akses internet |
| **Adapter untuk hal yang bergantung infrastruktur IT** | Login (`AUTH_MODE`), email (`MAIL_MODE`), penyimpanan file (`STORAGE_DIR`) bisa diganti lewat konfigurasi |
| **Aturan bisnis di database, bukan di kode** | Matriks approval, hari libur, master data dikelola Admin HR |
| **Zona waktu WIB & format DD/MM/YYYY** di seluruh aplikasi | Konsisten dengan kebutuhan pengguna |

## Fase dan status

| Fase | Isi | Output yang bisa dicoba | Status |
|---|---|---|---|
| **0. Fondasi** | Struktur proyek, skema database (seluruh tabel Lampiran E), data master (Lampiran A–C), data dummy karyawan, login dummy (pilih akun), layout mobile-first, Docker Compose | Aplikasi bisa dijalankan & login sebagai berbagai peran | ✅ Selesai |
| **1. Form e-PR & Approval** | Form e-PR lengkap + validasi + draft + ringkasan konfirmasi, PR NO otomatis, mesin matriks approval (skip otomatis), kotak masuk approver (setujui/tolak), timeline approval, duplikat PR, perhitungan hari kerja, log notifikasi email (simulasi) | Alur pengajuan → approval berjenjang → PR Received | ✅ Selesai |
| **2. Monitoring** | Dashboard Rekruter (filter, cari, detail, prioritas, PIC, tahap, kandidat, realisasi, hold/unhold/cancel + memo, Filled), Dashboard User (kartu HP/tabel desktop, versi ringkas), pengajuan Hold/Cancel oleh pemohon, export Excel | Rekruter mengelola PR; pemohon & Kadiv memantau progres | ✅ Selesai |
| **3. Admin, Laporan & Hybrid** | Panel Admin HR (master data, matriks approval, hari libur, hak pemohon tambahan), laporan & metrik (fulfillment rate, placement time, lama approval, PR terlambat, beban PIC), approval kertas + upload scan, Cetak PR (PDF) | Prototype lengkap untuk validasi HRD & atasan | ✅ Selesai |
| **4. Production (jaringan internal)** | Login NIK + password ESS (LDAP/API/SSO, atau akun lokal ber-hash), email SMTP perusahaan + pengingat approval tertunda, impor master karyawan, keamanan (HTTPS, rate limit, audit), backup DB, kepatuhan UU PDP, deploy ke server internal | Aplikasi live di jaringan perusahaan | ⏳ Berikutnya — butuh koordinasi IT |

## Keputusan yang dibutuhkan per fase

- **Validasi Fase 2 (asumsi yang dipakai, mohon dikonfirmasi):**
  - Pemohon/Kadiv dapat mengajukan Hold/Unhold/Cancel lewat sistem; rekruter yang mengeksekusi atau menolak (item #6).
  - Upload memo bersifat **opsional** saat Hold/Unhold/Cancel.
  - Prioritas & Recruiter PIC wajib diisi sebelum rekruter mengelola kandidat atau mengubah status.
  - Filled boleh dengan Realisasi < Kebutuhan bila rekruter mengisi alasan.
  - Filled dan Cancelled bersifat final (tidak bisa dibuka kembali).

- **Validasi Fase 3 (asumsi yang dipakai, mohon dikonfirmasi):**
  - Cetak PR memakai fitur "Simpan sebagai PDF" di browser (tanpa komponen tambahan di server).
  - Approval kertas diinput rekruter untuk tahap yang sedang menunggu; PR Received Date = tanggal input approval terakhir.
  - Fulfillment rate dihitung sesuai spesifikasi (termasuk PR Cancelled); versi tanpa Cancelled ditampilkan sebagai pembanding.
  - Lama approval ditampilkan dalam hari kalender dan hari kerja.
  - Aturan approval yang sudah dipakai PR tidak bisa dihapus, hanya dinonaktifkan.
- **Data yang diisi Admin HR lewat panel (tidak perlu menunggu developer):** matriks approval resmi (#1),
  Kadiv & Direktur pembina untuk 19 divisi yang masih kosong, hari libur 2027 (#7).
- **Sebelum Fase 4 (dengan IT):** metode login ESS (#3), server email (#9), spesifikasi server/VM, master karyawan (#2), kebijakan penyimpanan data (UU PDP).

Lihat [`DEPLOYMENT.md`](./DEPLOYMENT.md) untuk panduan memindahkan aplikasi ke server internal.
