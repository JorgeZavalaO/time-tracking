-- =====================================================================
-- Migration: sprint2_settings_sprint3_collaborator_rrhh
-- Sprint 2: CompanySettings (configuración global)
-- Sprint 3: Extensión RRHH de Collaborator (cargo, fecha ingreso, sueldo, tipo pago)
-- =====================================================================

-- CreateEnum: PaymentType
CREATE TYPE "PaymentType" AS ENUM ('MONTHLY', 'BIWEEKLY', 'WEEKLY');

-- CreateEnum: LateDiscountPolicy
CREATE TYPE "LateDiscountPolicy" AS ENUM ('BY_MINUTE', 'BY_RANGE');

-- CreateEnum: LunchDeductionType
CREATE TYPE "LunchDeductionType" AS ENUM ('FIXED', 'REAL_TIME');

-- -----------------------------------------------------------------------
-- AlterTable Collaborator: campos RRHH (Sprint 3)
-- -----------------------------------------------------------------------
ALTER TABLE "Collaborator"
  ADD COLUMN "position"    TEXT,
  ADD COLUMN "hireDate"    TIMESTAMP(3),
  ADD COLUMN "salary"      DECIMAL(12,2),
  ADD COLUMN "paymentType" "PaymentType";

-- -----------------------------------------------------------------------
-- CreateTable CompanySettings (singleton id=1)
-- -----------------------------------------------------------------------
CREATE TABLE "CompanySettings" (
    "id"                    INTEGER              NOT NULL DEFAULT 1,
    "companyName"           TEXT                 NOT NULL DEFAULT 'Mi Empresa',
    "ruc"                   TEXT,
    "timezone"              TEXT                 NOT NULL DEFAULT 'America/Lima',
    "lateTolerance"         INTEGER              NOT NULL DEFAULT 0,
    "lateDiscountPolicy"    "LateDiscountPolicy" NOT NULL DEFAULT 'BY_MINUTE',
    "overtimeEnabled"       BOOLEAN              NOT NULL DEFAULT false,
    "overtimeBeforeMinutes" INTEGER              NOT NULL DEFAULT 0,
    "overtimeAfterMinutes"  INTEGER              NOT NULL DEFAULT 0,
    "overtimeRoundMinutes"  INTEGER              NOT NULL DEFAULT 15,
    "lunchDurationMinutes"  INTEGER              NOT NULL DEFAULT 60,
    "lunchDeductionType"    "LunchDeductionType" NOT NULL DEFAULT 'FIXED',
    "createdAt"             TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- Insertar registro singleton con valores por defecto
INSERT INTO "CompanySettings" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
