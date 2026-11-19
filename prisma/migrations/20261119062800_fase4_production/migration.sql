-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "failedLogins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "errorTerakhir" TEXT,
ADD COLUMN     "percobaan" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "terkirimPada" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PrApproval" ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "reminderCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "NotificationLog_statusKirim_idx" ON "NotificationLog"("statusKirim");
