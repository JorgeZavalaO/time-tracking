/**
 * PATCH /api/access/[id]  → Editar tipo y/o timestamp de una marcación
 * DELETE /api/access/[id] → Eliminar una marcación
 * Ambas requieren motivo obligatorio y guardan bitácora en AccessEditHistory.
 */
import { NextRequest, NextResponse } from "next/server"
import dayjs from "dayjs"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { AuditStatus } from "@prisma/client"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"
import { recalculateDay } from "@/lib/recalculate"

const patchSchema = z.object({
  markType:  z.enum(["ENTRY", "LUNCH_OUT", "LUNCH_IN", "EXIT", "INCIDENCE"]).optional(),
  timestamp: z.string().datetime().optional(),
  status:    z.enum(["ON_TIME", "LATE"]).optional(),
  reason:    z.string().min(5, "El motivo debe tener al menos 5 caracteres"),
})

const deleteSchema = z.object({
  reason: z.string().min(5, "El motivo debe tener al menos 5 caracteres"),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireRole(...Permissions.COLLABORATOR_WRITE)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  const accessId = Number(id)
  if (isNaN(accessId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const data = patchSchema.parse(await req.json())

  const existing = await prisma.access.findUnique({ where: { id: accessId } })
  if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 })

  const updateData: Record<string, unknown> = {}
  if (data.markType)  updateData.markType  = data.markType
  if (data.timestamp) updateData.timestamp = new Date(data.timestamp)
  if (data.status)    updateData.status    = data.status

  const updated = await prisma.access.update({
    where: { id: accessId },
    data: updateData,
  })

  // Guardar en bitácora
  await prisma.accessEditHistory.create({
    data: {
      accessId,
      editedById: auth.userId,
      oldData: {
        markType:  existing.markType,
        timestamp: existing.timestamp,
        status:    existing.status,
      },
      newData: {
        markType:  updated.markType,
        timestamp: updated.timestamp,
        status:    updated.status,
      },
      reason: data.reason,
    },
  })

  await logAudit({
    actorId:   auth.userId,
    actorRole: auth.role,
    action:    "UPDATE",
    resource:  "ACCESS",
    resourceId: accessId,
    status:    AuditStatus.SUCCESS,
    before: { markType: existing.markType, timestamp: existing.timestamp },
    after:  { markType: updated.markType,  timestamp: updated.timestamp },
    reason: data.reason,
  })

  // Recálculo automático de minutesLate tras edición
  const editDate = dayjs(updated.timestamp).format("YYYY-MM-DD")
  await recalculateDay(existing.collaboratorId, editDate).catch(() => null)

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireRole(...Permissions.COLLABORATOR_WRITE)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  const accessId = Number(id)
  if (isNaN(accessId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const existing = await prisma.access.findUnique({ where: { id: accessId } })
  if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 })

  const { reason } = deleteSchema.parse(await req.json())

  // Guardar en bitácora ANTES de eliminar
  await prisma.accessEditHistory.create({
    data: {
      accessId,
      editedById: auth.userId,
      oldData: {
        markType:  existing.markType,
        timestamp: existing.timestamp,
        status:    existing.status,
        deleted:   true,
      },
      newData: { deleted: true },
      reason,
    },
  })

  // Eliminar justification primero (FK)
  await prisma.justification.deleteMany({ where: { accessId } })
  await prisma.access.delete({ where: { id: accessId } })

  await logAudit({
    actorId:   auth.userId,
    actorRole: auth.role,
    action:    "DELETE",
    resource:  "ACCESS",
    resourceId: accessId,
    status:    AuditStatus.SUCCESS,
    before: { markType: existing.markType, timestamp: existing.timestamp },
    reason,
  })

  // Recálculo automático tras eliminar
  const deleteDate = dayjs(existing.timestamp).format("YYYY-MM-DD")
  await recalculateDay(existing.collaboratorId, deleteDate).catch(() => null)

  return NextResponse.json({ ok: true })
}
