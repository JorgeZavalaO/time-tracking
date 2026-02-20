import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { hash } from "bcryptjs"
import { z } from "zod"

const bodySchema = z.object({
  name: z.string().min(2),
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

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const items = await prisma.kioskDevice.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      is_active: true,
      last_seen: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const data = bodySchema.parse(await req.json())

  const plainSecret = crypto.randomUUID().replace(/-/g, "")
  const secretHash = await hash(plainSecret, 10)

  const created = await prisma.kioskDevice.create({
    data: {
      name: data.name.trim(),
      secret_hash: secretHash,
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      is_active: true,
      createdAt: true,
    },
  })

  return NextResponse.json(
    {
      ...created,
      secret: plainSecret,
      note: "Guarda este secret ahora. No volverá a mostrarse.",
    },
    { status: 201 }
  )
}
