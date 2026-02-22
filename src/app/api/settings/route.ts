/**
 * GET  /api/settings  → devuelve la configuración de empresa (crea singleton si no existe)
 * PUT  /api/settings  → actualiza la configuración (solo ADMIN)
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { AuditStatus } from "@prisma/client"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"

const settingsSchema = z.object({
  companyName:            z.string().min(1).max(255).optional(),
  ruc:                    z.string().max(20).nullable().optional(),
  timezone:               z.string().max(100).optional(),
  lateTolerance:          z.number().int().min(0).max(120).optional(),
  lateDiscountPolicy:     z.enum(["BY_MINUTE", "BY_RANGE"]).optional(),
  overtimeEnabled:        z.boolean().optional(),
  overtimeBeforeMinutes:  z.number().int().min(0).max(120).optional(),
  overtimeAfterMinutes:   z.number().int().min(0).max(480).optional(),
  overtimeRoundMinutes:   z.number().int().min(1).max(60).optional(),
  lunchDurationMinutes:   z.number().int().min(0).max(180).optional(),
  lunchDeductionType:     z.enum(["FIXED", "REAL_TIME"]).optional(),
})

/** Obtiene o crea el singleton de configuración */
async function getOrCreateSettings() {
  return prisma.companySettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  })
}

export async function GET() {
  const authResult = await requireRole(...Permissions.AUDIT_READ)
  if (!authResult.ok) return authResult.response

  const settings = await getOrCreateSettings()
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const authResult = await requireRole(...Permissions.SETTINGS_WRITE)
  if (!authResult.ok) return authResult.response

  const body = settingsSchema.parse(await req.json())

  const before = await getOrCreateSettings()

  // Filtramos undefined para no sobreescribir campos no enviados
  const updateData = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined)
  )

  const updated = await prisma.companySettings.update({
    where: { id: 1 },
    data: updateData,
  })

  await logAudit({
    actorId: authResult.userId,
    actorRole: authResult.role,
    action: "SETTINGS_CHANGE",
    resource: "SETTINGS",
    resourceId: "1",
    status: AuditStatus.SUCCESS,
    before: { ...before, createdAt: undefined, updatedAt: undefined },
    after: { ...updated, createdAt: undefined, updatedAt: undefined },
  })

  return NextResponse.json(updated)
}
