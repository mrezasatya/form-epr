# Spesifikasi Web App Form e-PR (Personnel Request)

> **Status dokumen:** Draft v0.1 — 19 November 2026
> **Sumber:** `02_Format_data_ePR_input_monitoring_output_r1.xlsx` + keputusan pemilik produk (Reza, Learning & OD)
> **Fungsi:** *single source of truth* untuk pengembangan (Claude Code) dan bahan diskusi dengan HRD/IT.
> Item bertanda **[KONFIRMASI]** adalah asumsi yang masih perlu dipastikan — lihat Bagian 14.

---

## 1. Ringkasan

Web app untuk mengajukan, menyetujui, dan memantau permintaan tenaga kerja (e-PR) dari user ke tim rekrutmen. Isinya tiga modul:

1. **Form e-PR**, diisi oleh pemohon.
2. **Approval** berjenjang sesuai matriks approval.
3. **Monitoring**, terdiri dari Dashboard Rekruter (data lengkap) dan Dashboard User (ringkas, untuk pemohon dan Kepala Divisi).

**Tujuan bisnis:** semua PR tercatat di satu sistem, approval bisa dilacak, waktu pemenuhan (placement time) terukur, dan user bisa melihat progres rekrutmen tanpa harus bertanya manual.

## 2. Tahapan Pengembangan

| Tahap | Isi | Catatan |
|---|---|---|
| **1. Prototype** | Seluruh alur berjalan dengan data dummy dan bisa dibuka lewat link | Login, email, dan database disimulasikan. Dipakai untuk validasi alur dengan HRD dan atasan |
| **2. Production** | Database nyata, login NIK + password (ESS), email notifikasi, upload file | Butuh koordinasi IT: integrasi ESS, server email, persetujuan penyimpanan data (UU PDP) |

Rekomendasi stack production: Next.js + PostgreSQL (mis. Supabase) + deploy Vercel, **atau** server internal perusahaan bila IT mensyaratkan data tetap on-premise. Keputusan akhirnya ada di IT.

## 3. Peran Pengguna (Roles)

| Peran | Siapa | Hak akses |
|---|---|---|
| **Pemohon (Hiring Manager)** | Default: **Dept Head, Kepala Divisi, Direksi**. Opsional: **Section Head** atau **orang yang ditunjuk sebagai PM**, jika diberi hak oleh Admin HR | Membuat PR, melihat PR miliknya, mengajukan Hold/Unhold/Cancel |
| **Approver** | Sesuai matriks approval (Bagian 7) | Menyetujui atau menolak PR yang menunggu dirinya |
| **Kepala Divisi** | Kadiv tiap divisi | Melihat **seluruh PR di divisinya** (read-only), selain perannya sebagai approver/pemohon |
| **Rekruter** | Adnan, Acha, Ami | Mengelola semua PR: prioritas, tahap, kandidat, status, progress note, input approval kertas |
| **Admin HR** | Ditentukan HRD | Mengelola master data, matriks approval, hak pemohon tambahan (Section Head/PM), dan hari libur |

Satu orang bisa memegang lebih dari satu peran, misalnya Kadiv sebagai pemohon sekaligus approver.

## 4. Login

- Login memakai **NIK + password sesuai akun ESS** perusahaan.
- **[KONFIRMASI IT]** Ada dua opsi teknis:
  - (a) Integrasi langsung ke ESS (API/LDAP/SSO), sehingga password tidak disimpan di e-PR. **Ini yang disarankan.**
  - (b) Akun terpisah dengan NIK yang sama, dan password di-hash di database e-PR.
- Setelah login, profil pemohon (Nama, NIK, Jabatan, Job Level, Divisi, Departemen, email, atasan) diambil dari **master karyawan**.
- Prototype menyediakan pemilih akun dummy agar semua peran bisa dicoba.

## 5. Form e-PR (Input Pemohon)

### 5.1 Field

| No | Field | Tipe | Validasi / Pilihan | Wajib |
|---|---|---|---|---|
| 1 | Divisi | Auto | Dari profil pemohon (master Div & Dept). Read-only | Ya |
| 1a | Departemen | Auto | Dari profil pemohon. Jika pemohon Kadiv/Direksi atau punya akses lebih dari 1 dept: dropdown departemen di divisinya | Ya |
| 2 | Job Title | Text | Maks. 100 karakter. Disertai saran dari daftar jabatan baku (boleh ketik bebas) | Ya |
| 3 | Job Level | Dropdown | Clerical, Operator, Technician, Team Leader, Office Staff, Section Head, Department Head, Division Head | Ya |
| 4 | Job Responsibilities | Text area | Maks. 500 karakter, dengan penghitung karakter | Ya |
| 5 | Lokasi Kerja | Dropdown | Head Office, Workshop, Site Project **[KONFIRMASI: Remote dihapus]** | Ya |
| 7 | Level Pendidikan | Dropdown | SMA/SMK, D1, D3, D4/S1, S2, S3 | Ya |
| 8 | Jurusan | Combobox | Daftar jurusan (Lampiran B) + ketik manual + opsi "Semua jurusan". Boleh lebih dari 1 | Ya |
| 9 | Pengalaman | Dropdown | 0 tahun (Fresh Graduate), 1-2 tahun, 3-5 tahun, >5 tahun | Ya |
| 10 | Hard Skill | Text (tag) | Dipisah koma, contoh: PLC, SCADA, Python | Ya |
| 11 | Soft Skill | Text (tag) | Dipisah koma, contoh: Komunikasi, Teamwork | Ya |
| 12 | Sertifikasi Wajib | Ya/Tidak + combobox | Jika **Ya**, muncul isian nama sertifikat (daftar Lampiran C + ketik manual, boleh lebih dari 1) yang wajib diisi | Ya |
| 14 | Status of Employment | Dropdown | Contract, Project, Subcont, Paid Internship | Ya |
| 15 | Duration of Contract | Dropdown | 3 months, 6 months, 12 months, Others. Jika **Others**, muncul isian teks wajib | Ya |
| 16 | Kebutuhan | Integer | 1–99 | Ya |
| 17 | Jenis Kebutuhan | Dropdown | Replacement, Additional, Mutation | Ya |
| 17a | Nama Karyawan yang Digantikan | Text / pencarian karyawan | **Muncul dan wajib jika Replacement.** Jika Kebutuhan > 1, boleh lebih dari 1 nama | Kondisional |
| 18 | Expected Date | Date (DD/MM/YYYY) | Default otomatis = Tanggal Pengajuan + **45 hari kerja** (Bagian 9). Boleh diubah, tetapi harus ≥ Tanggal Pengajuan | Tidak* |
| 19 | Hiring Manager | Auto | Nama pemohon dari login. Read-only | Ya |
| 20 | Tanggal Pengajuan | Auto | Tanggal submit. Tidak bisa diedit | Ya |
| 21 | Catatan (Remarks) | Text area | Maks. 250 karakter | Tidak |

\* Karena selalu terisi default, data di dashboard selalu ada.

### 5.2 Perilaku Form
- Field kondisional (Sertifikat, Others, Nama yang Digantikan) muncul atau hilang secara dinamis.
- Validasi berjalan langsung (inline). Tombol Submit aktif hanya jika semua field wajib valid.
- Sebelum submit ditampilkan **ringkasan konfirmasi**.
- Setelah submit: **PR NO** dibuat otomatis, PR masuk ke status *Menunggu Approval 1*, dan email terkirim ke approver pertama.
- Pemohon dapat **menyimpan draft**, yang belum mendapat PR NO.
- PR yang sudah disubmit **tidak bisa diedit** oleh pemohon. Jika ditolak, pemohon membuat PR baru (lihat 7.3).

## 6. Format PR NO

```
NNN/SDM/PR/{BULAN ROMAWI}/{TAHUN}
contoh: 001/SDM/PR/XI/2026
```
- NNN = nomor urut **3 digit** (001, 002, …) **[KONFIRMASI: jawaban menyebut "mulai dari 01"; diasumsikan 001 karena 3 digit]**.
- Nomor urut berlaku global untuk semua divisi dan **di-reset setiap 1 Januari**.
- Bulan dan tahun diambil dari Tanggal Pengajuan.
- Nomor dibuat di sisi server/database secara atomik agar tidak ada nomor ganda.

## 7. Approval

### 7.1 Matriks Approval (bisa dikonfigurasi Admin HR)
Approval **mengikuti matriks** yang disimpan sebagai tabel aturan, bukan ditulis langsung di kode.

| Kolom aturan | Keterangan |
|---|---|
| Kondisi | Job Level (wajib), Divisi (opsional, kosong = semua), Status of Employment (opsional), Jenis Kebutuhan (opsional) |
| Approver 1–3 | Berupa **peran relatif** (mis. "Kadiv divisi pemohon", "Kepala HRD", "Direktur pembina divisi") atau **nama tertentu** |
| Jumlah level | 1 sampai 3 |

**Contoh placeholder** (akan diganti dengan matriks resmi **[KONFIRMASI: mohon kirim matriks approval perusahaan]**):

| Job Level | Approval 1 | Approval 2 | Approval 3 |
|---|---|---|---|
| Clerical, Operator, Technician, Team Leader, Office Staff | Kadiv pemohon | Kepala HRD | — |
| Section Head, Department Head | Kadiv pemohon | Kepala HRD | Direktur pembina |
| Division Head | Direktur pembina | Kepala HRD | Direktur Utama |

**Aturan otomatis:**
- Jika approver sama dengan pemohon (mis. Kadiv mengajukan), langkah itu **dilewati otomatis** dan dicatat di riwayat.
- Aturan yang paling spesifik dipakai lebih dulu (Divisi tertentu mengalahkan "semua").

### 7.2 Alur dan Status

```
Draft → Menunggu Approval 1 → Menunggu Approval 2 → Menunggu Approval 3 → Disetujui (PR Received)
                     ↘ Ditolak (di level mana pun) → selesai
Disetujui → Open → On Hold ⇄ Open → Filled | Cancelled
```
- **Status Persetujuan** di Dashboard User menampilkan posisi terkini, mis. "Menunggu Approval 2 – Kepala HRD". Jika diklik, muncul timeline approval (nama, tanggal, catatan).
- Saat approval terakhir disetujui, **PR Received Date** terisi otomatis dan Status Permintaan menjadi **Open**.

### 7.3 Tolak
- Approver hanya punya pilihan **Setujui** atau **Tolak**. Saat menolak, alasan wajib diisi.
- PR yang ditolak langsung ditutup (final). Pemohon mendapat email beserta alasannya dan bisa membuat PR baru. Disediakan tombol **"Duplikat PR"** agar pemohon tidak perlu mengetik ulang.

### 7.4 Approval Kertas (Hybrid)
- Rekruter bisa menginput manual **Approval 1–3 Name & Date** untuk PR yang disetujui di kertas, disertai upload scan (opsional).
- Tersedia **Cetak PR (PDF)** berisi data lengkap PR dan kolom tanda tangan sesuai matriks approval.

## 8. Notifikasi Email

| Pemicu | Penerima |
|---|---|
| PR disubmit / lanjut ke level berikutnya | Approver berikutnya (berisi link langsung untuk approve) |
| PR disetujui penuh | Pemohon, semua rekruter, Kadiv divisi |
| PR ditolak | Pemohon (dengan alasan) |
| Status berubah (On Hold, Unhold, Cancelled, Filled) | Pemohon, Kadiv divisi |
| Pengingat approval yang tertunda > 3 hari kerja **[KONFIRMASI]** | Approver yang bersangkutan |

- Production: email dikirim lewat SMTP perusahaan atau layanan email transaksional **[KONFIRMASI IT]**.
- Prototype: email disimulasikan dalam bentuk **log notifikasi** di aplikasi.

## 9. Perhitungan Hari Kerja

- Hari kerja = Senin–Jumat, **dikurangi libur nasional dan cuti bersama** **[KONFIRMASI: apakah Sabtu hari kerja untuk workshop/site?]**.
- Daftar libur disimpan di master **Hari Libur** yang dikelola Admin HR dan diisi setiap tahun sesuai SKB 3 Menteri.
- **Expected Date (default)** = Tanggal Pengajuan + 45 hari kerja.
- **Target Start Date (default)** = PR Received Date + 45 hari kerja. Rekruter boleh mengubahnya.
- **Placement Time (Days)** = Fulfillment Date − PR Received Date, dalam **hari kalender** (sesuai rumus brief).

## 10. Dashboard Rekruter

Tabel semua PR yang bisa difilter (Divisi, Status, Prioritas, Recruiter PIC, periode) dan dicari, ditambah halaman detail per PR.

| Kelompok | Field | Sumber / Aturan |
|---|---|---|
| A. Identitas | PR NO, Divisi, Departemen, Job Title, Job Level, Job Responsibilities, Lokasi Kerja | Dari form |
| B. Kualifikasi | Pendidikan, Jurusan, Pengalaman, Hard Skill, Soft Skill, Sertifikasi | Dari form |
| C. Kontrak | Status of Employment, Duration of Contract | Dari form |
| D. Kuantitas | Kebutuhan, **Realisasi** (otomatis = jumlah kandidat berstatus Joined, ≤ Kebutuhan), Jenis Kebutuhan, Nama yang Digantikan, **Prioritas** (High/Medium/Low, wajib diisi rekruter) | |
| E. Timeline & Approval | Tanggal Pengajuan, PR Received Date, Expected Date, Target Start Date, Approval 1–3 Name & Date | Otomatis, atau manual untuk approval kertas |
| F. Proses | Status Permintaan, Tahap Saat Ini, Kandidat, Fulfillment Date, Placement Time, Hiring Manager, **Recruiter PIC** (Adnan/Acha/Ami, wajib), Alasan Hold, Estimasi Selesai Hold, Progress Note, Note | Diisi rekruter |

### 10.1 Tahap Saat Ini
Rekruter memilih dari daftar **detail**. User melihat versi **ringkas** yang dipetakan otomatis:

| Detail (rekruter) | Ringkas (user) |
|---|---|
| *(belum diisi, PR baru Open)* | Menunggu |
| Sourcing, Screening CV | Sourcing |
| Interview HR, Interview User, Tes/Assessment | Interview |
| Offer, Negosiasi | Offer |
| Onboarding | Onboarding |
| Closed | Selesai |

### 10.2 Kandidat Final (bisa lebih dari 1)
Setiap kandidat dicatat per baris: **Nama, Sumber** (Internal Referral, Job Portal, LinkedIn, Headhunter, Campus, Database, Lainnya), **Status** (Offer Accepted / Joined / Batal), dan **Tanggal Join**.
- Realisasi = jumlah kandidat berstatus Joined.
- Fulfillment Date = Tanggal Join kandidat terakhir. Harus ≥ PR Received Date.
- Jika Realisasi = Kebutuhan, sistem **menyarankan** status Filled, lalu rekruter mengonfirmasi.

### 10.3 Hold / Unhold / Cancel
- **Hanya rekruter** yang mengubah Status Permintaan menjadi On Hold, Open (unhold), atau Cancelled, serta mengisi **Alasan Hold** dan **Estimasi Selesai Hold** (keduanya wajib jika On Hold).
- Memo hold/unhold/cancel (PDF/JPG, maks. 5 MB) di-upload rekruter dan riwayatnya tersimpan.
- **[KONFIRMASI]** Apakah pemohon perlu tombol *"Ajukan Hold/Cancel"* (permintaan ke rekruter dengan memo), atau cukup menghubungi rekruter di luar sistem? Asumsi saat ini: **tombol tersedia**. Permintaan pemohon masuk ke rekruter untuk dieksekusi.

### 10.4 Export
Export ke Excel (.xlsx) untuk semua kolom, mengikuti filter yang aktif.

## 11. Dashboard User (Pemohon & Kepala Divisi)

- **Pemohon** melihat PR miliknya. **Kadiv** melihat seluruh PR di divisinya.
- Tampilan berupa kartu di HP dan tabel di desktop.

| Field | Tampil | Keterangan |
|---|---|---|
| PR NO | Ya | |
| Tanggal Pengajuan | Ya | |
| Job Title | Ya | **Klik** untuk melihat isian e-PR lengkap |
| Divisi | Ya | |
| Kebutuhan / Realisasi | Ya | Contoh: 1/3 |
| Status Persetujuan | Ya | **Klik** untuk melihat timeline approval |
| Status Permintaan | Ya | Open / On Hold / Cancelled / Filled |
| Tahap Saat Ini (ringkas) | Ya | |
| Expected Date | Ya | |
| Kandidat Final | Kondisional | Muncul jika sudah ada kandidat Joined. Bisa lebih dari 1 |
| Fulfillment Date | Kondisional | Muncul jika Filled |
| Alasan Hold + Estimasi Selesai Hold | Kondisional | Muncul jika On Hold |
| Progress Note | Ya (jika ada) | Catatan dari rekruter untuk user |
| Riwayat aksi | Klik | Riwayat hold/unhold/cancel beserta memo |

## 12. Laporan & Metrik (Dashboard Ringkas)

Ditampilkan untuk rekruter dan Admin HR. Kadiv melihat versi yang terbatas pada divisinya.
- Jumlah PR per status (Menunggu Approval, Open, On Hold, Filled, Cancelled, Ditolak).
- **Fulfillment rate** = Σ Realisasi ÷ Σ Kebutuhan (PR yang sudah disetujui).
- **Rata-rata Placement Time** per divisi dan per Job Level.
- **Rata-rata lama approval** (Tanggal Pengajuan → PR Received Date).
- PR **melewati Expected Date** dan belum Filled (daftar peringatan).
- Beban kerja per Recruiter PIC.

## 13. Kebutuhan Non-Fungsional

- **Mobile-first**: nyaman di HP (pemohon di site/workshop), dengan tombol besar dan form satu kolom.
- **Label field mengikuti brief** (campuran Indonesia–Inggris).
- **Audit trail**: setiap perubahan status/field penting mencatat siapa dan kapan.
- **Keamanan & privasi**: akses dibatasi sesuai peran (pemohon tidak bisa melihat PR divisi lain), file upload disimpan privat, dan seluruh aspek mengikuti UU PDP. Lokasi penyimpanan data diputuskan bersama IT.
- Format tanggal **DD/MM/YYYY**, zona waktu WIB.

## 14. Item yang Masih Perlu Dikonfirmasi

| # | Item | Asumsi sementara |
|---|---|---|
| 1 | **Matriks approval resmi** | Placeholder di 7.1 |
| 2 | **Master data karyawan** (Nama, NIK, Jabatan, Job Level, Divisi, Dept, email, atasan, Kadiv & Direktur pembina per divisi) | Data dummy |
| 3 | Integrasi login ESS (API/LDAP) atau akun terpisah | Disarankan integrasi; prototype memakai akun dummy |
| 4 | Nomor urut PR mulai **001** atau **01** | 001 (3 digit) |
| 5 | Lokasi Kerja: opsi "Remote" dihapus? | Dihapus |
| 6 | Pemohon bisa mengajukan permintaan Hold/Cancel ke rekruter lewat sistem? | Ya, dieksekusi rekruter |
| 7 | Sabtu dihitung hari kerja? | Tidak |
| 8 | Pengingat approval tertunda (berapa hari) | 3 hari kerja |
| 9 | Server email & lokasi hosting production | Diputuskan IT |

---

## Lampiran A — Master Divisi & Departemen

| Divisi | Departemen |
|---|---|
| ACC | ACC |
| AP | AP |
| AUD | AUD |
| BGT | BGT |
| BIL | BIL |
| BOD/C | BOD/C |
| BPN | BPN |
| BSK | BSK |
| CGA | CGA, INF |
| ENG | C&S ENG, ENG, ENG EST, ME ENG, SUPP ENG |
| GSCM | GSC EM, GSC GEN, GSC IF, GSC LOG, GSC TR, GSCM |
| HRD | HRD |
| HSE | HSE |
| IT | IT |
| KLINIK | BP |
| LGL | LGL |
| MRK | MRK |
| PDO | PDO |
| PLTM | PLTM |
| PMO | PMO, PMO BRB, PMO JBT, PMO OGE, PMO SPV & RCE, PMO TWR, PMO-SUPP |
| PRF | PRF |
| PRO | PPIC, QC, WS A, WS B, WS C, WS C1, WS C2, WS D, WS E, WS F |
| QA | QA |
| TAX | TAX |
| TSR | FIN, TSR |

## Lampiran B — Daftar Awal Jurusan (bisa diedit Admin HR)

**Umum:** Semua jurusan

**SMA/SMK:** IPA, IPS, Teknik Mesin, Teknik Pengelasan, Teknik Pemesinan, Teknik Fabrikasi Logam, Teknik Instalasi Tenaga Listrik, Teknik Elektronika Industri, Teknik Otomasi Industri, Teknik Kendaraan Ringan, Teknik Alat Berat, Teknik Konstruksi Baja, Teknik Bangunan / Konstruksi Gedung, Teknik Gambar Bangunan, Desain Pemodelan & Informasi Bangunan (DPIB), Teknik Komputer & Jaringan, Rekayasa Perangkat Lunak, Akuntansi & Keuangan Lembaga, Otomatisasi & Tata Kelola Perkantoran, Logistik / Bisnis Daring & Pemasaran

**Diploma/Sarjana/Pascasarjana:** Teknik Mesin, Teknik Sipil, Teknik Elektro, Teknik Industri, Teknik Metalurgi & Material, Teknik Kimia, Teknik Lingkungan, Teknik Fisika, Teknik Mekatronika, Teknik Otomasi / Instrumentasi, Teknik Perkapalan, Teknik Geodesi / Geomatika, Arsitektur, Manajemen Konstruksi, Teknik Informatika / Ilmu Komputer, Sistem Informasi, Data Science / Statistika, Matematika, Fisika, Kimia, Akuntansi, Manajemen, Manajemen Keuangan, Perpajakan, Ekonomi Pembangunan, Administrasi Bisnis / Niaga, Hukum, Psikologi, Manajemen SDM, Komunikasi, Hubungan Internasional, Bahasa Inggris / Sastra Inggris, Desain Komunikasi Visual, Kesehatan & Keselamatan Kerja (K3), Kesehatan Masyarakat, Keperawatan, Kedokteran, Farmasi, Logistik / Supply Chain Management, Manajemen Transportasi

## Lampiran C — Daftar Awal Sertifikasi (bisa diedit Admin HR)

**K3:** Ahli K3 Umum (Kemnaker), Ahli K3 Konstruksi, Ahli K3 Listrik, Teknisi K3 Listrik, Petugas K3 Kebakaran, Petugas P3K, Bekerja di Ketinggian (TKBT Tingkat 1/2), Scaffolder, Rigger, Juru Ikat (Rigging), Ahli K3 Pesawat Angkat & Angkut

**Operator (SIO Kemnaker):** Operator Crane (Mobile/Overhead/Tower), Operator Forklift, Operator Alat Berat, Operator Boiler / Pesawat Uap

**Teknik & Konstruksi:** SKK Konstruksi (LPJK) – sesuai jenjang, Welder (SMAW/GTAW/FCAW – ASME/AWS/BNSP), Welding Inspector (CSWIP/AWS CWI), NDT Level II (UT/RT/MT/PT – ASNT), Quality Control / Inspector, Juru Ukur (Surveyor), Drafter (BNSP), Electrical Installation (BNSP)

**Manajemen & Profesional:** PMP / Project Management, Brevet Pajak A/B/C, Chartered Accountant (CA), CPA, Ahli Pengadaan Barang/Jasa, Sertifikasi Ekspor-Impor / Kepabeanan, CHRP / Sertifikasi SDM (BNSP), ISO 9001/14001/45001 Internal Auditor

**IT:** CCNA, Microsoft/Azure, AWS, Network & Security (CEH/CompTIA)

## Lampiran D — Daftar Pilihan (Dropdown) Lengkap

- **Status Permintaan:** Open, On Hold, Cancelled, Filled
- **Status Persetujuan:** Draft, Menunggu Approval 1/2/3, Disetujui, Ditolak
- **Tahap Saat Ini (detail):** Sourcing, Screening CV, Interview HR, Interview User, Tes/Assessment, Offer, Negosiasi, Onboarding, Closed
- **Tahap Saat Ini (ringkas):** Menunggu, Sourcing, Interview, Offer, Onboarding, Selesai
- **Prioritas:** High, Medium, Low
- **Recruiter PIC:** Adnan, Acha, Ami
- **Sumber Kandidat:** Internal Referral, Job Portal, LinkedIn, Headhunter, Campus, Database, Lainnya
- **Status Kandidat:** Offer Accepted, Joined, Batal

## Lampiran E — Model Data (ringkas, untuk developer)

- `employees` (nik, nama, jabatan, job_level, divisi, departemen, email, atasan_nik, roles[], is_requester_extra)
- `divisions` (kode, nama, kadiv_nik, direktur_pembina_nik) · `departments` (kode, divisi_kode)
- `approval_rules` (id, job_levels[], divisi?, status_employment?, jenis_kebutuhan?, approver1..3 {type: role|person, value}, prioritas_aturan)
- `pr_requests` (seluruh field form + pr_no, status_persetujuan, status_permintaan, tahap_detail, prioritas, recruiter_pic, pr_received_date, target_start_date, alasan_hold, estimasi_selesai_hold, progress_note, note)
- `pr_approvals` (pr_id, level, approver_nik, approver_nama, keputusan, tanggal, catatan, sumber: sistem|kertas)
- `pr_candidates` (pr_id, nama, sumber, status, tanggal_join)
- `pr_status_history` (pr_id, aksi, dari, ke, oleh, tanggal, alasan, file_memo)
- `pr_replaced_employees` (pr_id, nik?, nama)
- `pr_counters` (tahun, nomor_terakhir) · `holidays` (tanggal, keterangan)
- `master_jurusan`, `master_sertifikasi`, `master_jabatan`
- `notifications_log` (pr_id, penerima, jenis, waktu, status_kirim)
