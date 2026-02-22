-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('DRAFT', 'CLOSED');

-- CreateTable
CREATE TABLE "PayrollSnapshot" (
    "id" SERIAL NOT NULL,
    "period" TEXT NOT NULL,
    "paymentCycle" TEXT NOT NULL,
    "half" INTEGER NOT NULL DEFAULT 1,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'DRAFT',
    "items" JSONB NOT NULL,
    "settingsSnapshot" JSONB NOT NULL,
    "totalNet" DECIMAL(14,2) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" SERIAL NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "collaboratorId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollSnapshot_period_idx" ON "PayrollSnapshot"("period");

-- CreateIndex
CREATE INDEX "PayrollSnapshot_status_idx" ON "PayrollSnapshot"("status");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_snapshotId_idx" ON "PayrollAdjustment"("snapshotId");

-- AddForeignKey
ALTER TABLE "PayrollSnapshot" ADD CONSTRAINT "PayrollSnapshot_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSnapshot" ADD CONSTRAINT "PayrollSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PayrollSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
