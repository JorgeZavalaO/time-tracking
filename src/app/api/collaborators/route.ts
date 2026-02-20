// LISTADO con paginación y búsqueda + CREAR un colaborador
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma, ScheduleType } from "@prisma/client"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { hash } from "bcryptjs"

const qSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().default(""),
})
const bodySchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  name: z.string().min(2),
  active: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  scheduleSpecialId: z.number().int().positive().nullable().optional(),
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

export async function GET(req: NextRequest) {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { page, pageSize, search } = qSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    )
  
    const where: Prisma.CollaboratorWhereInput = search
      ? {
          OR: [
            { dni: { contains: search } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}
  
    const [total, items] = await Promise.all([
      prisma.collaborator.count({ where }),
      prisma.collaborator.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { name: "asc" },
        include: { scheduleSpecial: true },
      }),
    ])
  
    // fetch horario general **una sola vez** si hay huecos
    const general =
      items.some((i) => !i.scheduleSpecial) &&
      (await prisma.schedule.findFirst({
        where: { type: ScheduleType.GENERAL },
        select: { id: true, startTime: true, days: true },
      }))
  
    const normalized = items.map((c) => ({
      id: c.id,
      dni: c.dni,
      name: c.name,
      active: c.active,
      isBlocked: c.is_blocked,
      hasPin: Boolean(c.pin_hash),
      hasQr: Boolean(c.qr_token),
      schedule: c.scheduleSpecial ?? general!,
    }))
  
    return NextResponse.json({ items: normalized, total })
  }

  export async function POST(req: NextRequest) {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const data = bodySchema.parse(await req.json())
    try {
      const pinHash = data.pin ? await hash(data.pin, 10) : null
      const created = await prisma.collaborator.create({
        data: {
          dni: data.dni,
          name: data.name,
          active: data.active ?? true,
          is_active: data.active ?? true,
          is_blocked: data.isBlocked ?? false,
          pin_hash: pinHash,
          qr_token: crypto.randomUUID(),
          scheduleSpecialId: data.scheduleSpecialId ?? null,
        },
        select: {
          id: true,
          dni: true,
          name: true,
          active: true,
          is_blocked: true,
          qr_token: true,
          createdAt: true,
        },
      })
      return NextResponse.json(created, { status: 201 })
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        return NextResponse.json({ error: "DNI duplicado" }, { status: 409 })
      throw e
    }
  }