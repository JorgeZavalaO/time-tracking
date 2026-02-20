import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
    select: { id: true, role: true },
  })

  if (!user || user.role !== "admin") return null
  return user
}

export async function POST(_req: NextRequest, ctx: unknown) {
  const { params } = ctx as { params: { id: string } }
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  const collaborator = await prisma.collaborator.findUnique({
    where: { id },
    select: { id: true, name: true, dni: true },
  })

  if (!collaborator) {
    return NextResponse.json({ error: "Colaborador no encontrado" }, { status: 404 })
  }

  const qrToken = crypto.randomUUID()

  await prisma.collaborator.update({
    where: { id },
    data: { qr_token: qrToken },
  })

  return NextResponse.json({
    collaboratorId: collaborator.id,
    collaboratorName: collaborator.name,
    qrToken,
    qrPayload: `tt:${qrToken}`,
  })
}
