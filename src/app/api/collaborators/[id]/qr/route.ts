import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { AuditStatus } from "@prisma/client"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"

export async function POST(_req: NextRequest, ctx: unknown) {
  const { params } = ctx as { params: { id: string } }

  const authResult = await requireRole(...Permissions.CREDENTIAL_WRITE)
  if (!authResult.ok) return authResult.response

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido", code: "INVALID_ID" }, { status: 400 })
  }

  const collaborator = await prisma.collaborator.findUnique({
    where: { id },
    select: { id: true, name: true, dni: true },
  })

  if (!collaborator) {
    return NextResponse.json({ error: "Colaborador no encontrado", code: "NOT_FOUND" }, { status: 404 })
  }

  const qrToken = crypto.randomUUID()

  await prisma.collaborator.update({
    where: { id },
    data: { qr_token: qrToken },
  })

  await logAudit({
    actorId: authResult.userId,
    actorRole: authResult.role,
    action: "QR_REGEN",
    resource: "QR",
    resourceId: id,
    status: AuditStatus.SUCCESS,
    metadata: { collaboratorDni: collaborator.dni, collaboratorName: collaborator.name },
  })

  return NextResponse.json({
    collaboratorId: collaborator.id,
    collaboratorName: collaborator.name,
    qrToken,
    qrPayload: `tt:${qrToken}`,
  })
}
