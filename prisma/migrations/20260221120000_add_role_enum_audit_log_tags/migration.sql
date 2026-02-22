-- =====================================================================
-- Migration: add_role_enum_audit_log_tags
-- Sprint 1: Roles seguros + bitácora completa
-- =====================================================================

-- CreateEnum: Role
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RRHH', 'SUPERVISOR', 'READ_ONLY');

-- CreateEnum: AuditStatus
CREATE TYPE "AuditStatus" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- -----------------------------------------------------------------------
-- AlterTable User: migrar role de String → Role enum con backfill seguro
-- -----------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN "role_new" "Role" NOT NULL DEFAULT 'ADMIN'::"Role";

-- Backfill: mapear valores legacy al enum
UPDATE "User" SET "role_new" =
  CASE
    WHEN LOWER("role") IN ('admin', 'administrador') THEN 'ADMIN'::"Role"
    WHEN LOWER("role") IN ('rrhh', 'hr')             THEN 'RRHH'::"Role"
    WHEN LOWER("role") IN ('supervisor')              THEN 'SUPERVISOR'::"Role"
    WHEN LOWER("role") IN ('read_only', 'readonly', 'solo lectura') THEN 'READ_ONLY'::"Role"
    ELSE 'ADMIN'::"Role"  -- fallback seguro
  END;

ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" RENAME COLUMN "role_new" TO "role";

-- -----------------------------------------------------------------------
-- AlterTable Collaborator: añadir campo tags
-- -----------------------------------------------------------------------
ALTER TABLE "Collaborator" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- -----------------------------------------------------------------------
-- AlterTable ScheduleHistory: ampliar campos de historial
-- -----------------------------------------------------------------------
ALTER TABLE "ScheduleHistory"
  ADD COLUMN "oldDays"  TEXT[]         NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "newDays"  TEXT[]         NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "oldType"  "ScheduleType",
  ADD COLUMN "newType"  "ScheduleType",
  ADD COLUMN "reason"   TEXT;

-- -----------------------------------------------------------------------
-- CreateTable AuditLog
-- -----------------------------------------------------------------------
CREATE TABLE "AuditLog" (
    "id"         SERIAL         NOT NULL,
    "actorId"    INTEGER,
    "actorRole"  TEXT,
    "action"     TEXT           NOT NULL,
    "resource"   TEXT           NOT NULL,
    "resourceId" TEXT,
    "status"     "AuditStatus"  NOT NULL,
    "error"      TEXT,
    "before"     JSONB,
    "after"      JSONB,
    "reason"     TEXT,
    "metadata"   JSONB,
    "createdAt"  TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Índices para consultas frecuentes de auditoría
CREATE INDEX "AuditLog_actorId_idx"           ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");
CREATE INDEX "AuditLog_createdAt_idx"          ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_status_idx"      ON "AuditLog"("action", "status");

-- FK AuditLog → User (SET NULL si el actor es eliminado)
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
