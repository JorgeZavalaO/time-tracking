// LISTADO con paginación y búsqueda + CREAR un colaborador
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma, ScheduleType } from "@prisma/client"
import { z } from "zod"

const qSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().default(""),
})
const bodySchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  name: z.string().min(2),
  active: z.boolean().optional(),
  scheduleSpecialId: z.number().int().positive().nullable().optional(),
})

export async function GET(req: NextRequest) {
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
      schedule: c.scheduleSpecial ?? general!,
    }))
  
    return NextResponse.json({ items: normalized, total })
  }

  export async function POST(req: NextRequest) {
    const data = bodySchema.parse(await req.json())
    try {
      const created = await prisma.collaborator.create({
        data: {
          dni: data.dni,
          name: data.name,
          active: data.active ?? true,
          scheduleSpecialId: data.scheduleSpecialId ?? null,
        },
      })
      return NextResponse.json(created, { status: 201 })
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        return NextResponse.json({ error: "DNI duplicado" }, { status: 409 })
      throw e
    }
  }