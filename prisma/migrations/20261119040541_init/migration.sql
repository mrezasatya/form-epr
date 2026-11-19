-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'MENUNGGU_APPROVAL', 'DISETUJUI', 'DITOLAK');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'ON_HOLD', 'CANCELLED', 'FILLED');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('MENUNGGU', 'PENDING', 'DISETUJUI', 'DITOLAK', 'DILEWATI', 'DIBATALKAN');

-- CreateTable
CREATE TABLE "Employee" (
    "nik" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jabatan" TEXT NOT NULL,
    "jobLevel" TEXT NOT NULL,
    "divisiKode" TEXT NOT NULL,
    "departemenKode" TEXT NOT NULL,
    "email" TEXT,
    "atasanNik" TEXT,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isRequesterExtra" BOOLEAN NOT NULL DEFAULT false,
    "extraDepartments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("nik")
);

-- CreateTable
CREATE TABLE "Division" (
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kadivNik" TEXT,
    "direkturPembinaNik" TEXT,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("kode")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "kode" TEXT NOT NULL,
    "divisiKode" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterJurusan" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "kelompok" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MasterJurusan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterSertifikasi" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "kelompok" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MasterSertifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterJabatan" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,

    CONSTRAINT "MasterJabatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "tanggal" DATE NOT NULL,
    "keterangan" TEXT NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("tanggal")
);

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "jobLevels" TEXT[],
    "divisiKode" TEXT,
    "statusEmployment" TEXT,
    "jenisKebutuhan" TEXT,
    "approvers" JSONB NOT NULL,
    "prioritas" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrRequest" (
    "id" TEXT NOT NULL,
    "prNo" TEXT,
    "requesterNik" TEXT NOT NULL,
    "requesterNama" TEXT NOT NULL,
    "divisiKode" TEXT NOT NULL,
    "departemenKode" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobLevel" TEXT NOT NULL,
    "jobResponsibilities" TEXT NOT NULL,
    "lokasiKerja" TEXT NOT NULL,
    "levelPendidikan" TEXT NOT NULL,
    "jurusan" TEXT[],
    "pengalaman" TEXT NOT NULL,
    "hardSkills" TEXT[],
    "softSkills" TEXT[],
    "sertifikasiWajib" BOOLEAN NOT NULL,
    "sertifikasi" TEXT[],
    "statusEmployment" TEXT NOT NULL,
    "durationContract" TEXT NOT NULL,
    "durationOthers" TEXT,
    "kebutuhan" INTEGER NOT NULL,
    "jenisKebutuhan" TEXT NOT NULL,
    "expectedDate" DATE NOT NULL,
    "tanggalPengajuan" DATE,
    "remarks" TEXT,
    "statusPersetujuan" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "currentLevel" INTEGER,
    "approvalRuleId" INTEGER,
    "prReceivedDate" DATE,
    "statusPermintaan" "RequestStatus",
    "tahapDetail" TEXT,
    "prioritas" TEXT,
    "recruiterPic" TEXT,
    "targetStartDate" DATE,
    "alasanHold" TEXT,
    "estimasiSelesaiHold" DATE,
    "progressNote" TEXT,
    "note" TEXT,
    "duplicatedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrApproval" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "approverNik" TEXT,
    "approverNama" TEXT NOT NULL,
    "approverPeran" TEXT NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'MENUNGGU',
    "tanggal" TIMESTAMP(3),
    "catatan" TEXT,
    "sumber" TEXT NOT NULL DEFAULT 'SISTEM',
    "scanFile" TEXT,

    CONSTRAINT "PrApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrCandidate" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "sumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tanggalJoin" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrStatusHistory" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "aksi" TEXT NOT NULL,
    "dari" TEXT,
    "ke" TEXT,
    "olehNik" TEXT,
    "olehNama" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alasan" TEXT,
    "fileMemo" TEXT,

    CONSTRAINT "PrStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrReplacedEmployee" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "nik" TEXT,
    "nama" TEXT NOT NULL,

    CONSTRAINT "PrReplacedEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrCounter" (
    "tahun" INTEGER NOT NULL,
    "nomorTerakhir" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PrCounter_pkey" PRIMARY KEY ("tahun")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "prId" TEXT,
    "penerimaNik" TEXT,
    "penerima" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "subjek" TEXT NOT NULL,
    "isi" TEXT NOT NULL,
    "link" TEXT,
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusKirim" TEXT NOT NULL DEFAULT 'SIMULASI',

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Employee_divisiKode_idx" ON "Employee"("divisiKode");

-- CreateIndex
CREATE UNIQUE INDEX "Department_divisiKode_kode_key" ON "Department"("divisiKode", "kode");

-- CreateIndex
CREATE UNIQUE INDEX "MasterJurusan_nama_key" ON "MasterJurusan"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "MasterSertifikasi_nama_key" ON "MasterSertifikasi"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "MasterJabatan_nama_key" ON "MasterJabatan"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "PrRequest_prNo_key" ON "PrRequest"("prNo");

-- CreateIndex
CREATE INDEX "PrRequest_requesterNik_idx" ON "PrRequest"("requesterNik");

-- CreateIndex
CREATE INDEX "PrRequest_divisiKode_idx" ON "PrRequest"("divisiKode");

-- CreateIndex
CREATE INDEX "PrRequest_statusPersetujuan_idx" ON "PrRequest"("statusPersetujuan");

-- CreateIndex
CREATE INDEX "PrApproval_approverNik_status_idx" ON "PrApproval"("approverNik", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PrApproval_prId_level_key" ON "PrApproval"("prId", "level");

-- CreateIndex
CREATE INDEX "PrStatusHistory_prId_idx" ON "PrStatusHistory"("prId");

-- CreateIndex
CREATE INDEX "NotificationLog_penerimaNik_idx" ON "NotificationLog"("penerimaNik");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_divisiKode_fkey" FOREIGN KEY ("divisiKode") REFERENCES "Division"("kode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_divisiKode_fkey" FOREIGN KEY ("divisiKode") REFERENCES "Division"("kode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrApproval" ADD CONSTRAINT "PrApproval_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PrRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrCandidate" ADD CONSTRAINT "PrCandidate_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PrRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrStatusHistory" ADD CONSTRAINT "PrStatusHistory_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PrRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrReplacedEmployee" ADD CONSTRAINT "PrReplacedEmployee_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PrRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PrRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
