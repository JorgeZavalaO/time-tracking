/**
 * POST /api/access → handler principal de marcación (kiosk)
 * GET  /api/access → listado paginado para panel admin (con filtros)
 */
import handler from "./handler"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { requireRole, Permissions } from "@/lib/auth-guard"

export const POST = handler

const qSchema = z.object({
  page:           z.coerce.number().int().positive().default(1),
  pageSize:       z.coerce.number().int().positive().max(100).default(20),
  search:         z.string().trim().default(""),
  date:           z.string().optional(),         // "YYYY-MM-DD" (día exacto, compatibilidad)
  dateFrom:       z.string().optional(),         // "YYYY-MM-DD" inicio de rango
  dateTo:         z.string().optional(),         // "YYYY-MM-DD" fin de rango
  markType:       z.string().optional(),         // MarkType value
  status:         z.enum(["ON_TIME", "LATE"]).optional(),
  collaboratorId: z.coerce.number().int().positive().optional(),
  hasEdits:       z.coerce.boolean().optional(), // true → solo con historial de edición
})

export async function GET(req: NextRequest) {
  const auth = await requireRole(...Permissions.COLLABORATOR_READ)
  if (!auth.ok) return auth.response

  const {
    page, pageSize, search, date, dateFrom, dateTo,
    markType, status, collaboratorId, hasEdits,
  } = qSchema.parse(Object.fromEntries(req.nextUrl.searchParams))

  const where: Record<string, unknown> = {}

  if (collaboratorId) {
    where.collaboratorId = collaboratorId
  } else if (search) {
    where.collaborator = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { dni:  { contains: search } },
      ],
    }
  }

  // Rango de fechas: date (exacto) tiene prioridad; si no, usar dateFrom/dateTo
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`)
    const end   = new Date(`${date}T23:59:59.999Z`)
    where.timestamp = { gte: start, lte: end }
  } else if (dateFrom || dateTo) {
    const tsFilter: Record<string, Date> = {}
    if (dateFrom) tsFilter.gte = new Date(`${dateFrom}T00:00:00.000Z`)
    if (dateTo)   tsFilter.lte = new Date(`${dateTo}T23:59:59.999Z`)
    where.timestamp = tsFilter
  }

  if (markType) {
    where.markType = markType
  }

  if (status) {
    where.status = status
  }

  if (hasEdits) {
    where.editHistories = { some: {} }
  }

  const [total, items] = await Promise.all([
    prisma.access.count({ where }),
    prisma.access.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { timestamp: "desc" },
      include: {
        collaborator: { select: { id: true, dni: true, name: true } },
        editHistories: {
          orderBy: { editedAt: "desc" },
          include: { editedBy: { select: { id: true, name: true, email: true } } },
        },
        justification: true,
      },
    }),
  ])

  return NextResponse.json({ items, total })
}
