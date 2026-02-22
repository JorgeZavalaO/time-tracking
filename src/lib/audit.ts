/**
 * audit.ts
 * Helper para registrar eventos de auditoría en AuditLog.
 *
 * Diseñado para ser fire-and-forget (nunca lanza al caller)
 * pero registra errores internos en consola.
 *
 * Uso:
 *   await logAudit({
 *     actorId: user.id,
 *     actorRole: user.role,
 *     action: "CREATE",
 *     resource: "COLLABORATOR",
 *     resourceId: created.id,
 *     status: "SUCCESS",
 *     after: created,
 *   })
 */

import { prisma } from "@/lib/prisma"
import { AuditStatus, Role } from "@prisma/client"
import { Prisma } from "@prisma/client"

// --------------------------------------------------------------------------
// Tipos
// --------------------------------------------------------------------------

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "ACCESS_ATTEMPT"
  | "ACCESS_DENIED"
  | "QR_REGEN"
  | "PIN_CHANGE"
  | "LOGIN"
  | "LOGIN_DENIED"
  | "SETTINGS_CHANGE"

export type AuditResource =
  | "COLLABORATOR"
  | "SCHEDULE"
  | "ACCESS"
  | "USER"
  | "QR"
  | "SETTINGS"
  | "REPORT"

export interface AuditPayload {
  actorId?: number | null
  actorRole?: Role | string | null
  action: AuditAction | string
  resource: AuditResource | string
  resourceId?: string | number | null
  status: AuditStatus
  error?: string | null
  before?: unknown
  after?: unknown
  reason?: string | null
  metadata?: unknown
}

// --------------------------------------------------------------------------
// Campos a redactar para evitar filtrar secretos en auditoría
// --------------------------------------------------------------------------
const REDACTED_KEYS = new Set(["pin", "pin_hash", "password", "token", "secret", "qr_token"])

function redact(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== "object") return obj
  if (Array.isArray(obj)) return obj.map(redact)

  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = REDACTED_KEYS.has(k) ? "[REDACTED]" : redact(v)
  }
  return result
}

// --------------------------------------------------------------------------
// logAudit: escribe el evento en la tabla AuditLog
// --------------------------------------------------------------------------
export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId:    payload.actorId    ?? null,
        actorRole:  payload.actorRole  ? String(payload.actorRole) : null,
        action:     payload.action,
        resource:   payload.resource,
        resourceId: payload.resourceId != null ? String(payload.resourceId) : null,
        status:     payload.status,
        error:      payload.error      ?? null,
        before:     payload.before  != null
          ? redact(payload.before)  as Prisma.InputJsonValue
          : Prisma.JsonNull,
        after:      payload.after   != null
          ? redact(payload.after)   as Prisma.InputJsonValue
          : Prisma.JsonNull,
        reason:     payload.reason     ?? null,
        metadata:   payload.metadata != null
          ? redact(payload.metadata) as Prisma.InputJsonValue
          : Prisma.JsonNull,
      },
    })
  } catch (err) {
    // La auditoría nunca debe romper el flujo principal
    console.error("[AuditLog] Error al escribir registro:", err)
  }
}
