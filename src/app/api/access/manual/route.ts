/**
 * POST /api/access/manual
 * Inserción manual de una marcación por Admin/RRHH (con motivo obligatorio y auditoría).
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { AuditStatus } from "@prisma/client"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"

const bodySchema = z.object({
  collaboratorId: z.number().int().positive(),
  markType: z.enum(["ENTRY", "LUNCH_OUT", "LUNCH_IN", "EXIT", "INCIDENCE"]),
  timestamp: z.string().datetime(),
  reason: z.string().min(5, "El motivo debe tener al menos 5 caracteres"),
  status: z.enum(["ON_TIME", "LATE"]).optional().default("ON_TIME"),
})

export async function POST(req: NextRequest) {
  const auth = await requireRole(...Permissions.COLLABORATOR_WRITE)
  if (!auth.ok) return auth.response

  const data = bodySchema.parse(await req.json())

  // Verificar que el colaborador existe
  const collaborator = await prisma.collaborator.findUnique({
    where: { id: data.collaboratorId },
    select: { id: true, name: true, dni: true },
  })
  if (!collaborator) {
    return NextResponse.json({ error: "Colaborador no encontrado" }, { status: 404 })
  }

  const access = await prisma.access.create({
    data: {
      collaboratorId: data.collaboratorId,
      markType:       data.markType,
      status:         data.status,
      timestamp:      new Date(data.timestamp),
      recordedById:   auth.userId,
    },
    include: { collaborator: { select: { id: true, name: true, dni: true } } },
  })

  // Crear justificación con el motivo
  await prisma.justification.create({
    data: {
      accessId:    access.id,
      reason:      data.reason,
      createdById: auth.userId,
    },
  })

  await logAudit({
    actorId:   auth.userId,
    actorRole: auth.role,
    action:    "CREATE",
    resource:  "ACCESS",
    resourceId: access.id,
    status:    AuditStatus.SUCCESS,
    after: {
      collaboratorId: data.collaboratorId,
      markType:       data.markType,
      timestamp:      data.timestamp,
      manual:         true,
    },
    reason: data.reason,
  })

  return NextResponse.json(access, { status: 201 })
}
