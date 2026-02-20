/*
  Warnings:

  - You are about to drop the column `kioskId` on the `Access` table. All the data in the column will be lost.
  - You are about to drop the `KioskDevice` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Access" DROP CONSTRAINT "Access_kioskId_fkey";

-- AlterTable
ALTER TABLE "Access" DROP COLUMN "kioskId";

-- DropTable
DROP TABLE "KioskDevice";
