# Checklist Go-Live e-PR

Urutan kerja dari prototype ke production di jaringan internal. Kolom **PIC** diisi saat rapat koordinasi.

## A. Keputusan yang dibutuhkan

### Dari IT
| # | Pertanyaan | Dampak bila belum dijawab |
|---|---|---|
| IT-1 | **Metode login:** apakah ESS memakai Active Directory/LDAP? Bila ya: host & port (idealnya LDAPS 636), base DN, apakah username = NIK atau NIK disimpan di atribut lain (mis. `employeeID`), dan apakah tersedia akun layanan read-only? Bila ESS hanya punya API/SSO (SAML/OIDC), mohon dokumentasinya. | Sementara memakai `AUTH_MODE=local` (password e-PR terpisah yang direset Admin HR). |
| IT-2 | **Server email:** host & port SMTP relay internal, perlu login atau tidak, TLS, dan alamat pengirim (mis. `epr-noreply@...`). Apakah IP server e-PR perlu didaftarkan di relay? | Notifikasi hanya tercatat di aplikasi (`MAIL_MODE=log`). |
| IT-3 | **Hosting:** VM Linux + Docker atau Windows Server? Spesifikasi (2 vCPU/4 GB/40 GB), nama DNS (mis. `epr.perusahaan.local`), sertifikat SSL internal, reverse proxy yang dipakai. | Tidak bisa deploy. |
| IT-4 | **Database:** PostgreSQL di dalam Docker (paling sederhana) atau server PostgreSQL milik IT? | Default: container PostgreSQL di VM yang sama. |
| IT-5 | **Akses dari site/workshop:** apakah pengguna di site bisa menjangkau jaringan kantor (VPN/MPLS)? Perlu akses dari internet? | Pemohon di site mungkin tidak bisa mengakses. |
| IT-6 | **Backup & monitoring:** lokasi penyimpanan backup terpisah, jadwal, dan alat monitoring yang dipakai (untuk `/api/health`). | Risiko kehilangan data. |
| IT-7 | **Data karyawan:** format ekspor master karyawan dari HRIS/ESS (kolom & nama Job Level), dan apakah bisa dijadwalkan rutin. | Impor manual oleh Admin HR memakai template. |

### Dari HRD / manajemen
| # | Item | Catatan |
|---|---|---|
| HR-1 | Matriks approval resmi | Diinput Admin HR di menu Matriks Approval; uji dengan Simulator |
| HR-2 | Kadiv & Direktur pembina setiap divisi | 19+ divisi masih kosong; PR dari divisi kosong akan gagal diajukan |
| HR-3 | Hari libur nasional & cuti bersama 2026–2027, dan apakah Sabtu dihitung hari kerja | Data 2026 di seed hanya contoh — verifikasi dengan SKB 3 Menteri |
| HR-4 | Daftar Admin HR (≥ 2 orang) dan rekruter | Rekruter: Adnan, Acha, Ami (nama PIC di sistem harus sama dengan nama akun) |
| HR-5 | Konfirmasi asumsi Fase 1–3 (lihat ROADMAP) | mis. pengingat 3 hari kerja, memo opsional, Filled sebagian |
| HR-6 | Kebijakan retensi data & akses (UU PDP) | Bersama DPO/Legal |

## B. Langkah teknis

| # | Langkah | Verifikasi | PIC |
|---|---|---|---|
| 1 | Siapkan VM, DNS, sertifikat, reverse proxy | `https://epr.../api/health` → ok | IT |
| 2 | Isi `.env` production (lihat DEPLOYMENT §5) | — | IT |
| 3 | `docker compose up -d --build` | Health ok, log `[jobs] aktif` | IT |
| 4 | Buat Admin HR pertama (`scripts/create-admin.ts`) | Admin bisa login | IT + HR |
| 5 | Admin HR → Sistem: semua butir "Kesiapan production" ✓ | Kirim email uji diterima | IT + HR |
| 6 | Impor master karyawan dari HRIS | Pratinjau tanpa error | HR |
| 7 | Atur peran (Rekruter, Kepala HRD, Dirut), hak pemohon tambahan | — | HR |
| 8 | Atur Kadiv & Direktur pembina, matriks approval, hari libur | Simulator approval sesuai matriks resmi | HR |
| 9 | Jadwalkan backup harian + **uji restore** ke server uji | Restore berhasil | IT |
| 10 | UAT (bagian C) dengan pengguna perwakilan | Semua skenario lulus | HR + user |
| 11 | Sosialisasi & panduan singkat pengguna | — | HR |
| 12 | Go-live; PR kertas berjalan paralel 2–4 minggu (approval kertas diinput rekruter) | — | HR |

## C. Skenario UAT minimum
1. Dept Head login (password ESS) dari HP di site → buat PR Replacement → email sampai ke Kadiv.
2. Kadiv approve dari tautan email → Kepala HRD approve → rekruter & pemohon menerima email "disetujui".
3. Kadiv mengajukan PR sendiri → Approval 1 dilewati otomatis.
4. Approver menolak → pemohon menerima alasan → Duplikat PR.
5. Rekruter: prioritas & PIC, kandidat, Hold dengan memo, Unhold, Filled → pemohon & Kadiv menerima email status.
6. Approval kertas + scan → Cetak PR (PDF).
7. Laporan: angka cocok dengan perhitungan manual untuk sampel 5 PR; Export Excel.
8. Pengguna divisi lain tidak bisa membuka PR/memo divisi lain.
9. 5x password salah → terkunci; Admin HR membuka kunci.

## D. Rollback
Bila terjadi masalah besar saat go-live: kembali ke proses kertas, aplikasi tetap berjalan untuk input approval
kertas oleh rekruter. Data aman di database + backup harian; pemulihan memakai `scripts/restore.sh`.
