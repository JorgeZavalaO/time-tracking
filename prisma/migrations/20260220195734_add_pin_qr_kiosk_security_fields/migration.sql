/*
  Warnings:

  - A unique constraint covering the columns `[qr_token]` on the table `Collaborator` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Access" ADD COLUMN     "confidence_flag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deviceFingerprint" TEXT,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "kioskId" INTEGER,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "suspicious_reason" TEXT;

-- AlterTable
ALTER TABLE "Collaborator" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "pin_hash" TEXT,
ADD COLUMN     "qr_token" TEXT;

-- CreateTable
CREATE TABLE "KioskDevice" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KioskDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessEditHistory" (
    "id" SERIAL NOT NULL,
    "accessId" INTEGER NOT NULL,
    "editedById" INTEGER NOT NULL,
    "oldData" JSONB NOT NULL,
    "newData" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessEditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Collaborator_qr_token_key" ON "Collaborator"("qr_token");

-- AddForeignKey
ALTER TABLE "Access" ADD CONSTRAINT "Access_kioskId_fkey" FOREIGN KEY ("kioskId") REFERENCES "KioskDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessEditHistory" ADD CONSTRAINT "AccessEditHistory_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "Access"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessEditHistory" ADD CONSTRAINT "AccessEditHistory_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
