/**
 * PATCH /api/payroll/snapshot/[id]/close
 * Cierra el snapshot (DRAFT → CLOSED). Operación irreversible.
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { AuditStatus } from "@prisma/client"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"

export async function PATCH(_req: NextRequest, ctx: unknown) {
  const { params } = ctx as { params: { id: string } }
  const auth = await requireRole(...Permissions.COLLABORATOR_WRITE)
  if (!auth.ok) return auth.response

  const id = Number(params.id)
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const snapshot = await prisma.payrollSnapshot.findUnique({ where: { id } })
  if (!snapshot) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (snapshot.status === "CLOSED") {
    return NextResponse.json({ error: "El período ya está cerrado" }, { status: 409 })
  }

  // Calcular totalNet incluyendo ajustes
  const adjustments = await prisma.payrollAdjustment.findMany({ where: { snapshotId: id } })
  const adjustmentsTotal = adjustments.reduce((a, adj) => a + Number(adj.amount), 0)
  const finalTotalNet    = Number(snapshot.totalNet) + adjustmentsTotal

  const updated = await prisma.payrollSnapshot.update({
    where: { id },
    data: {
      status:      "CLOSED",
      closedAt:    new Date(),
      closedById:  auth.userId,
      totalNet:    finalTotalNet,
    },
  })

  await logAudit({
    actorId:    auth.userId,
    actorRole:  auth.role,
    action:     "CLOSE",
    resource:   "PAYROLL_SNAPSHOT",
    resourceId: id,
    status:     AuditStatus.SUCCESS,
    before:     { status: "DRAFT", totalNet: snapshot.totalNet },
    after:      { status: "CLOSED", totalNet: finalTotalNet, adjustments: adjustments.length },
  })

  return NextResponse.json(updated)
}
