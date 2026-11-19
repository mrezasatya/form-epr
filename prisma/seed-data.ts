// Data master awal (Spec Lampiran A–C) dan data DUMMY karyawan untuk prototype.
// Data karyawan di sini fiktif — di production diganti impor master karyawan resmi.

export const DIVISIONS: Record<string, string[]> = {
  ACC: ["ACC"],
  AP: ["AP"],
  AUD: ["AUD"],
  BGT: ["BGT"],
  BIL: ["BIL"],
  "BOD/C": ["BOD/C"],
  BPN: ["BPN"],
  BSK: ["BSK"],
  CGA: ["CGA", "INF"],
  ENG: ["C&S ENG", "ENG", "ENG EST", "ME ENG", "SUPP ENG"],
  GSCM: ["GSC EM", "GSC GEN", "GSC IF", "GSC LOG", "GSC TR", "GSCM"],
  HRD: ["HRD"],
  HSE: ["HSE"],
  IT: ["IT"],
  KLINIK: ["BP"],
  LGL: ["LGL"],
  MRK: ["MRK"],
  PDO: ["PDO"],
  PLTM: ["PLTM"],
  PMO: ["PMO", "PMO BRB", "PMO JBT", "PMO OGE", "PMO SPV & RCE", "PMO TWR", "PMO-SUPP"],
  PRF: ["PRF"],
  PRO: ["PPIC", "QC", "WS A", "WS B", "WS C", "WS C1", "WS C2", "WS D", "WS E", "WS F"],
  QA: ["QA"],
  TAX: ["TAX"],
  TSR: ["FIN", "TSR"],
};

export const JURUSAN: Record<string, string[]> = {
  UMUM: ["Semua jurusan"],
  SMA_SMK: [
    "IPA", "IPS", "Teknik Mesin", "Teknik Pengelasan", "Teknik Pemesinan", "Teknik Fabrikasi Logam",
    "Teknik Instalasi Tenaga Listrik", "Teknik Elektronika Industri", "Teknik Otomasi Industri",
    "Teknik Kendaraan Ringan", "Teknik Alat Berat", "Teknik Konstruksi Baja",
    "Teknik Bangunan / Konstruksi Gedung", "Teknik Gambar Bangunan",
    "Desain Pemodelan & Informasi Bangunan (DPIB)", "Teknik Komputer & Jaringan",
    "Rekayasa Perangkat Lunak", "Akuntansi & Keuangan Lembaga",
    "Otomatisasi & Tata Kelola Perkantoran", "Logistik / Bisnis Daring & Pemasaran",
  ],
  PT: [
    "Teknik Sipil", "Teknik Elektro", "Teknik Industri", "Teknik Metalurgi & Material", "Teknik Kimia",
    "Teknik Lingkungan", "Teknik Fisika", "Teknik Mekatronika", "Teknik Otomasi / Instrumentasi",
    "Teknik Perkapalan", "Teknik Geodesi / Geomatika", "Arsitektur", "Manajemen Konstruksi",
    "Teknik Informatika / Ilmu Komputer", "Sistem Informasi", "Data Science / Statistika", "Matematika",
    "Fisika", "Kimia", "Akuntansi", "Manajemen", "Manajemen Keuangan", "Perpajakan",
    "Ekonomi Pembangunan", "Administrasi Bisnis / Niaga", "Hukum", "Psikologi", "Manajemen SDM",
    "Komunikasi", "Hubungan Internasional", "Bahasa Inggris / Sastra Inggris",
    "Desain Komunikasi Visual", "Kesehatan & Keselamatan Kerja (K3)", "Kesehatan Masyarakat",
    "Keperawatan", "Kedokteran", "Farmasi", "Logistik / Supply Chain Management",
    "Manajemen Transportasi",
  ],
};

export const SERTIFIKASI: Record<string, string[]> = {
  K3: [
    "Ahli K3 Umum (Kemnaker)", "Ahli K3 Konstruksi", "Ahli K3 Listrik", "Teknisi K3 Listrik",
    "Petugas K3 Kebakaran", "Petugas P3K", "Bekerja di Ketinggian (TKBT Tingkat 1/2)", "Scaffolder",
    "Rigger", "Juru Ikat (Rigging)", "Ahli K3 Pesawat Angkat & Angkut",
  ],
  "Operator (SIO Kemnaker)": [
    "Operator Crane (Mobile/Overhead/Tower)", "Operator Forklift", "Operator Alat Berat",
    "Operator Boiler / Pesawat Uap",
  ],
  "Teknik & Konstruksi": [
    "SKK Konstruksi (LPJK) – sesuai jenjang", "Welder (SMAW/GTAW/FCAW – ASME/AWS/BNSP)",
    "Welding Inspector (CSWIP/AWS CWI)", "NDT Level II (UT/RT/MT/PT – ASNT)",
    "Quality Control / Inspector", "Juru Ukur (Surveyor)", "Drafter (BNSP)",
    "Electrical Installation (BNSP)",
  ],
  "Manajemen & Profesional": [
    "PMP / Project Management", "Brevet Pajak A/B/C", "Chartered Accountant (CA)", "CPA",
    "Ahli Pengadaan Barang/Jasa", "Sertifikasi Ekspor-Impor / Kepabeanan",
    "CHRP / Sertifikasi SDM (BNSP)", "ISO 9001/14001/45001 Internal Auditor",
  ],
  IT: ["CCNA", "Microsoft/Azure", "AWS", "Network & Security (CEH/CompTIA)"],
};

export const JABATAN = [
  "Welder", "Fitter", "Machinist", "Operator CNC", "Operator Crane", "Operator Forklift",
  "Rigger", "Scaffolder", "Painter / Blaster", "Electrician", "Mechanic", "QC Inspector",
  "NDT Technician", "HSE Officer", "HSE Supervisor", "Drafter", "Design Engineer", "Mechanical Engineer",
  "Civil / Structure Engineer", "Electrical Engineer", "Estimator", "Project Engineer",
  "Project Control", "Site Manager", "Supervisor Produksi", "Foreman", "PPIC Staff", "Warehouse Staff",
  "Logistic Staff", "Purchasing Staff", "Admin Site", "Accounting Staff", "Tax Staff", "Finance Staff",
  "HR Staff", "Recruitment Staff", "IT Support", "Programmer", "Legal Staff", "Nurse / Perawat",
];

/** Hari libur nasional & cuti bersama 2026 — CONTOH, wajib diverifikasi Admin HR dengan SKB 3 Menteri. */
export const HOLIDAYS_2026: [string, string][] = [
  ["2026-01-01", "Tahun Baru Masehi"],
  ["2026-01-16", "Isra Mikraj Nabi Muhammad SAW"],
  ["2026-02-17", "Tahun Baru Imlek"],
  ["2026-03-19", "Hari Suci Nyepi"],
  ["2026-03-20", "Idul Fitri 1447 H"],
  ["2026-03-23", "Idul Fitri 1447 H / cuti bersama"],
  ["2026-04-03", "Wafat Yesus Kristus"],
  ["2026-05-01", "Hari Buruh"],
  ["2026-05-14", "Kenaikan Yesus Kristus"],
  ["2026-05-27", "Idul Adha 1447 H"],
  ["2026-05-31", "Hari Raya Waisak"],
  ["2026-06-01", "Hari Lahir Pancasila"],
  ["2026-06-16", "Tahun Baru Islam 1448 H"],
  ["2026-08-17", "Hari Kemerdekaan RI"],
  ["2026-08-25", "Maulid Nabi Muhammad SAW"],
  ["2026-12-25", "Hari Raya Natal"],
  ["2026-12-24", "Cuti bersama Natal"],
  // 2027: baru Tahun Baru (tanggal pasti). Sisanya diisi Admin HR setelah SKB 3 Menteri terbit.
  ["2027-01-01", "Tahun Baru Masehi"],
];

/** Direktur pembina per divisi (dummy). */
export const DIREKTUR_PEMBINA: Record<string, string> = {
  // Direktur Operasional
  ENG: "100002", PRO: "100002", PMO: "100002", GSCM: "100002", HSE: "100002", QA: "100002",
  PLTM: "100002", PDO: "100002", BPN: "100002",
  // Direktur Keuangan & SDM
  ACC: "100003", AP: "100003", AUD: "100003", BGT: "100003", BIL: "100003", TAX: "100003",
  TSR: "100003", PRF: "100003", HRD: "100003", CGA: "100003", IT: "100003", LGL: "100003",
  KLINIK: "100003", BSK: "100003", MRK: "100003",
  // BOD
  "BOD/C": "100001",
};

type Emp = {
  nik: string;
  nama: string;
  jabatan: string;
  jobLevel: string;
  divisiKode: string;
  departemenKode: string;
  atasanNik?: string;
  roles?: string[];
  isRequesterExtra?: boolean;
  extraDepartments?: string[];
};

export const EMPLOYEES: Emp[] = [
  { nik: "100001", nama: "Budi Santoso", jabatan: "Direktur Utama", jobLevel: "Director", divisiKode: "BOD/C", departemenKode: "BOD/C", roles: ["DIREKTUR_UTAMA"] },
  { nik: "100002", nama: "Hendra Wijaya", jabatan: "Direktur Operasional", jobLevel: "Director", divisiKode: "BOD/C", departemenKode: "BOD/C", atasanNik: "100001" },
  { nik: "100003", nama: "Ratna Sari", jabatan: "Direktur Keuangan & SDM", jobLevel: "Director", divisiKode: "BOD/C", departemenKode: "BOD/C", atasanNik: "100001" },

  { nik: "200001", nama: "Siti Rahmawati", jabatan: "Kepala Divisi HRD", jobLevel: "Division Head", divisiKode: "HRD", departemenKode: "HRD", atasanNik: "100003", roles: ["KEPALA_HRD"] },
  { nik: "200002", nama: "Agus Prasetyo", jabatan: "Kepala Divisi Produksi", jobLevel: "Division Head", divisiKode: "PRO", departemenKode: "PPIC", atasanNik: "100002" },
  { nik: "200003", nama: "Dewi Lestari", jabatan: "Kepala Divisi Engineering", jobLevel: "Division Head", divisiKode: "ENG", departemenKode: "ENG", atasanNik: "100002" },
  { nik: "200004", nama: "Fajar Nugroho", jabatan: "Kepala Divisi GSCM", jobLevel: "Division Head", divisiKode: "GSCM", departemenKode: "GSCM", atasanNik: "100002" },
  { nik: "200005", nama: "Lukman Hakim", jabatan: "Kepala Divisi PMO", jobLevel: "Division Head", divisiKode: "PMO", departemenKode: "PMO", atasanNik: "100002" },

  { nik: "300001", nama: "Rudi Hartono", jabatan: "Department Head Workshop A", jobLevel: "Department Head", divisiKode: "PRO", departemenKode: "WS A", atasanNik: "200002" },
  { nik: "300002", nama: "Maya Putri", jabatan: "Department Head ME Engineering", jobLevel: "Department Head", divisiKode: "ENG", departemenKode: "ME ENG", atasanNik: "200003" },
  { nik: "300003", nama: "Yoga Pratama", jabatan: "Section Head QC", jobLevel: "Section Head", divisiKode: "PRO", departemenKode: "QC", atasanNik: "200002", isRequesterExtra: true },
  { nik: "300004", nama: "Indra Gunawan", jabatan: "Project Manager Tower", jobLevel: "Section Head", divisiKode: "PMO", departemenKode: "PMO TWR", atasanNik: "200005", isRequesterExtra: true },

  { nik: "400001", nama: "Adnan", jabatan: "Recruiter", jobLevel: "Office Staff", divisiKode: "HRD", departemenKode: "HRD", atasanNik: "200001", roles: ["RECRUITER"] },
  { nik: "400002", nama: "Acha", jabatan: "Recruiter", jobLevel: "Office Staff", divisiKode: "HRD", departemenKode: "HRD", atasanNik: "200001", roles: ["RECRUITER"] },
  { nik: "400003", nama: "Ami", jabatan: "Recruiter", jobLevel: "Office Staff", divisiKode: "HRD", departemenKode: "HRD", atasanNik: "200001", roles: ["RECRUITER"] },
  { nik: "400004", nama: "Nadia Kusuma", jabatan: "HR Admin / HRIS", jobLevel: "Office Staff", divisiKode: "HRD", departemenKode: "HRD", atasanNik: "200001", roles: ["ADMIN_HR"] },

  { nik: "500001", nama: "Joko Susilo", jabatan: "Welder", jobLevel: "Operator", divisiKode: "PRO", departemenKode: "WS A", atasanNik: "300001" },
  { nik: "500002", nama: "Slamet Riyadi", jabatan: "Fitter", jobLevel: "Operator", divisiKode: "PRO", departemenKode: "WS A", atasanNik: "300001" },
  { nik: "500003", nama: "Andi Saputra", jabatan: "QC Inspector", jobLevel: "Technician", divisiKode: "PRO", departemenKode: "QC", atasanNik: "300003" },
  { nik: "500004", nama: "Rina Marlina", jabatan: "Drafter", jobLevel: "Office Staff", divisiKode: "ENG", departemenKode: "ME ENG", atasanNik: "300002" },
];

export const KADIV: Record<string, string> = {
  HRD: "200001",
  PRO: "200002",
  ENG: "200003",
  GSCM: "200004",
  PMO: "200005",
  "BOD/C": "100001",
};

/** Matriks approval PLACEHOLDER (Spec 7.1) — akan diganti matriks resmi. */
export const APPROVAL_RULES = [
  {
    nama: "Staf & non-staf",
    jobLevels: ["Clerical", "Operator", "Technician", "Team Leader", "Office Staff"],
    approvers: [
      { type: "ROLE", value: "KADIV_PEMOHON" },
      { type: "ROLE", value: "KEPALA_HRD" },
    ],
  },
  {
    nama: "Section Head & Department Head",
    jobLevels: ["Section Head", "Department Head"],
    approvers: [
      { type: "ROLE", value: "KADIV_PEMOHON" },
      { type: "ROLE", value: "KEPALA_HRD" },
      { type: "ROLE", value: "DIREKTUR_PEMBINA" },
    ],
  },
  {
    nama: "Division Head",
    jobLevels: ["Division Head"],
    approvers: [
      { type: "ROLE", value: "DIREKTUR_PEMBINA" },
      { type: "ROLE", value: "KEPALA_HRD" },
      { type: "ROLE", value: "DIREKTUR_UTAMA" },
    ],
  },
];
