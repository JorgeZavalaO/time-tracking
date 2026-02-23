// LISTADO con paginación y búsqueda + CREAR un colaborador
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma, ScheduleType } from "@prisma/client"
import { z } from "zod"
import { hash } from "bcryptjs"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"
import { AuditStatus } from "@prisma/client"

const qSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().default(""),
  tag: z.string().trim().optional(),
})
const bodySchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  name: z.string().min(2),
  active: z.boolean().optional(),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  scheduleSpecialId: z.number().int().positive().nullable().optional(),
  // RRHH (Sprint 3)
  position: z.string().max(100).nullable().optional(),
  hireDate: z.string().datetime().nullable().optional(),
  salary: z.number().positive().nullable().optional(),
  paymentType: z.enum(["MONTHLY", "BIWEEKLY", "WEEKLY"]).nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
})

export async function GET(req: NextRequest) {
    const auth = await requireRole(...Permissions.COLLABORATOR_READ)
    if (!auth.ok) return auth.response

    const { page, pageSize, search, tag } = qSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    )

    const where: Prisma.CollaboratorWhereInput = {
      ...(search
        ? {
            OR: [
              { dni: { contains: search } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(tag ? { tags: { has: tag } } : {}),
    }
  
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
      hasPin: Boolean(c.pin_hash),
      hasQr: Boolean(c.qr_token),
      photoUrl: c.photo_url,
      position: c.position,
      hireDate: c.hireDate,
      salary: c.salary ? Number(c.salary) : null,
      paymentType: c.paymentType,
      tags: c.tags,
      schedule: c.scheduleSpecial ?? general!,
    }))
  
    return NextResponse.json({ items: normalized, total })
  }

  export async function POST(req: NextRequest) {
    const authResult = await requireRole(...Permissions.COLLABORATOR_WRITE)
    if (!authResult.ok) return authResult.response

    const data = bodySchema.parse(await req.json())
    try {
      const pinHash = data.pin ? await hash(data.pin, 10) : null
      const created = await prisma.collaborator.create({
        data: {
          dni: data.dni,
          name: data.name,
          active: data.active ?? true,
          is_active: data.active ?? true,
          pin_hash: pinHash,
          qr_token: crypto.randomUUID(),
          scheduleSpecialId: data.scheduleSpecialId ?? null,
          position: data.position ?? null,
          hireDate: data.hireDate ? new Date(data.hireDate) : null,
          salary: data.salary ?? null,
          paymentType: data.paymentType ?? null,
          tags: data.tags ?? [],
        },
        select: {
          id: true,
          dni: true,
          name: true,
          active: true,
          qr_token: true,
          createdAt: true,
        },
      })

      await logAudit({
        actorId: authResult.userId,
        actorRole: authResult.role,
        action: "CREATE",
        resource: "COLLABORATOR",
        resourceId: created.id,
        status: AuditStatus.SUCCESS,
        after: { dni: created.dni, name: created.name, active: created.active },
      })

      return NextResponse.json(created, { status: 201 })
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        return NextResponse.json({ error: "DNI duplicado", code: "DUPLICATE_DNI" }, { status: 409 })
      throw e
    }
  }