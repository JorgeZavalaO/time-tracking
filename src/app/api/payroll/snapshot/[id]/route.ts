/**
 * GET    /api/payroll/snapshot/[id]        — Detalle con adjustments
 * PATCH  /api/payroll/snapshot/[id]/close  — Cierra el período (DRAFT → CLOSED)
 * GET    /api/payroll/snapshot/[id]/export — Descarga xlsx o pdf
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, Permissions } from "@/lib/auth-guard"

export async function GET(_req: NextRequest, ctx: unknown) {
  const { params } = ctx as { params: { id: string } }
  const auth = await requireRole(...Permissions.COLLABORATOR_WRITE)
  if (!auth.ok) return auth.response

  const id = Number(params.id)
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const snapshot = await prisma.payrollSnapshot.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      closedBy:  { select: { id: true, name: true } },
      adjustments: {
        include: {
          collaborator: { select: { id: true, name: true } },
          createdBy:    { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!snapshot) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  return NextResponse.json(snapshot)
}
