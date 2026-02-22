/**
 * DELETE /api/payroll/snapshot/[id]/adjustments/[adjId]
 * Elimina un ajuste si el snapshot todavía está en DRAFT.
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { AuditStatus } from "@prisma/client"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"

export async function DELETE(_req: NextRequest, ctx: unknown) {
  const { params } = ctx as { params: { id: string; adjId: string } }
  const auth = await requireRole(...Permissions.COLLABORATOR_WRITE)
  if (!auth.ok) return auth.response

  const snapshotId = Number(params.id)
  const adjId      = Number(params.adjId)
  if (!snapshotId || !adjId) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 })
  }

  const snapshot = await prisma.payrollSnapshot.findUnique({ where: { id: snapshotId } })
  if (!snapshot) return NextResponse.json({ error: "Snapshot no encontrado" }, { status: 404 })
  if (snapshot.status === "CLOSED") {
    return NextResponse.json({ error: "No se pueden eliminar ajustes de un período cerrado" }, { status: 409 })
  }

  const adjustment = await prisma.payrollAdjustment.findUnique({ where: { id: adjId } })
  if (!adjustment || adjustment.snapshotId !== snapshotId) {
    return NextResponse.json({ error: "Ajuste no encontrado" }, { status: 404 })
  }

  await prisma.payrollAdjustment.delete({ where: { id: adjId } })

  await logAudit({
    actorId:    auth.userId,
    actorRole:  auth.role,
    action:     "DELETE",
    resource:   "PAYROLL_ADJUSTMENT",
    resourceId: adjId,
    status:     AuditStatus.SUCCESS,
    before:     { snapshotId, collaboratorId: adjustment.collaboratorId, amount: adjustment.amount, description: adjustment.description },
  })

  return new NextResponse(null, { status: 204 })
}
