/**
 * POST   /api/payroll/snapshot/[id]/adjustments   — Añade un ajuste puntual
 * DELETE /api/payroll/snapshot/[id]/adjustments/[adjId] se maneja en [adjId]/route.ts
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { AuditStatus } from "@prisma/client"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"

const bodySchema = z.object({
  collaboratorId: z.number().int().positive(),
  amount:         z.number(),   // positivo = bonus, negativo = descuento
  description:    z.string().min(3).max(500),
})

export async function POST(req: NextRequest, ctx: unknown) {
  const { params } = ctx as { params: { id: string } }
  const auth = await requireRole(...Permissions.COLLABORATOR_WRITE)
  if (!auth.ok) return auth.response

  const id = Number(params.id)
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const snapshot = await prisma.payrollSnapshot.findUnique({ where: { id } })
  if (!snapshot) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (snapshot.status === "CLOSED") {
    return NextResponse.json({ error: "No se pueden añadir ajustes a un período cerrado" }, { status: 409 })
  }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { collaboratorId, amount, description } = parsed.data

  const adjustment = await prisma.payrollAdjustment.create({
    data: {
      snapshotId: id,
      collaboratorId,
      amount,
      description,
      createdById: auth.userId,
    },
    include: {
      collaborator: { select: { id: true, name: true } },
      createdBy:    { select: { id: true, name: true } },
    },
  })

  await logAudit({
    actorId:    auth.userId,
    actorRole:  auth.role,
    action:     "CREATE",
    resource:   "PAYROLL_ADJUSTMENT",
    resourceId: adjustment.id,
    status:     AuditStatus.SUCCESS,
    after:      { snapshotId: id, collaboratorId, amount, description },
  })

  return NextResponse.json(adjustment, { status: 201 })
}
