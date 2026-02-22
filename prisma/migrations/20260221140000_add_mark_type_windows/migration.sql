-- Sprint 5: Terminal Central de Marcación
-- Añade enum MarkType, campo markType en Access,
-- ventanas de marcación y campos adicionales en CompanySettings

-- 1. Crear enum MarkType
CREATE TYPE "MarkType" AS ENUM ('ENTRY', 'LUNCH_OUT', 'LUNCH_IN', 'EXIT', 'INCIDENCE');

-- 2. Añadir campo markType a Access (default ENTRY para registros históricos)
ALTER TABLE "Access" ADD COLUMN "markType" "MarkType" NOT NULL DEFAULT 'ENTRY';

-- 3. Añadir campos de ventanas de marcación y configuración a CompanySettings
ALTER TABLE "CompanySettings" ADD COLUMN "lunchRequired"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompanySettings" ADD COLUMN "entryWindowStart" TEXT    NOT NULL DEFAULT '05:00';
ALTER TABLE "CompanySettings" ADD COLUMN "entryWindowEnd"   TEXT    NOT NULL DEFAULT '11:00';
ALTER TABLE "CompanySettings" ADD COLUMN "lunchWindowStart" TEXT    NOT NULL DEFAULT '11:00';
ALTER TABLE "CompanySettings" ADD COLUMN "lunchWindowEnd"   TEXT    NOT NULL DEFAULT '15:30';
ALTER TABLE "CompanySettings" ADD COLUMN "exitWindowStart"  TEXT    NOT NULL DEFAULT '15:00';
ALTER TABLE "CompanySettings" ADD COLUMN "exitWindowEnd"    TEXT    NOT NULL DEFAULT '23:00';
ALTER TABLE "CompanySettings" ADD COLUMN "maxMarksPerDay"   INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "CompanySettings" ADD COLUMN "lunchSkipHours"   INTEGER NOT NULL DEFAULT 4;
