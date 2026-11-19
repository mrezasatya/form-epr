-- AlterTable
ALTER TABLE "PrRequest" ADD COLUMN     "fulfillmentDate" DATE;

-- CreateTable
CREATE TABLE "PrActionRequest" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "alasan" TEXT NOT NULL,
    "estimasiSelesai" DATE,
    "fileMemo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'MENUNGGU',
    "olehNik" TEXT NOT NULL,
    "olehNama" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diprosesOleh" TEXT,
    "diprosesPada" TIMESTAMP(3),
    "catatanProses" TEXT,

    CONSTRAINT "PrActionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrActionRequest_prId_idx" ON "PrActionRequest"("prId");

-- CreateIndex
CREATE INDEX "PrActionRequest_status_idx" ON "PrActionRequest"("status");

-- AddForeignKey
ALTER TABLE "PrActionRequest" ADD CONSTRAINT "PrActionRequest_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PrRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
