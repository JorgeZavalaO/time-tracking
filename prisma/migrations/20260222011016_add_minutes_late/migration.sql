-- AlterTable
ALTER TABLE "Access" ADD COLUMN     "minutesLate" INTEGER;

-- AlterTable
ALTER TABLE "CompanySettings" ALTER COLUMN "updatedAt" DROP DEFAULT;
