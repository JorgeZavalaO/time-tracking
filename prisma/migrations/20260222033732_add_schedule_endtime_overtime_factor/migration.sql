-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "overtimeFactor" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
ADD COLUMN     "workdayHours" INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "endTime" TEXT;
