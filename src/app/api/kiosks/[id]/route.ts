import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { hash } from "bcryptjs"
import { z } from "zod"

const putSchema = z.object({
  name: z.string().min(2).optional(),
  is_active: z.boolean().optional(),
  rotateSecret: z.boolean().optional(),
})

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

export async function PUT(req: NextRequest, ctx: unknown) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { params } = ctx as { params: { id: string } }
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  const data = putSchema.parse(await req.json())

  let newSecret: string | undefined
  let secretHash: string | undefined
  if (data.rotateSecret) {
    newSecret = crypto.randomUUID().replace(/-/g, "")
    secretHash = await hash(newSecret, 10)
  }

  const updated = await prisma.kioskDevice.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      is_active: data.is_active,
      secret_hash: secretHash,
    },
    select: {
      id: true,
      name: true,
      is_active: true,
      last_seen: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    ...updated,
    ...(newSecret
      ? { secret: newSecret, note: "Guarda este secret ahora. No volverá a mostrarse." }
      : {}),
  })
}

export async function DELETE(_req: NextRequest, ctx: unknown) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { params } = ctx as { params: { id: string } }
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  await prisma.kioskDevice.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
