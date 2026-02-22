/**
 * GET /api/payroll
 * Calcula la pre-planilla para un período.
 *
 * Query params:
 *   period         "YYYY-MM"          (requerido)
 *   paymentCycle   "MONTHLY" | "BIWEEKLY" | "WEEKLY"  (default: MONTHLY)
 *   half           1 | 2              (solo para BIWEEKLY, default: 1)
 *   collaboratorId number             (opcional — si se omite, devuelve todos)
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import dayjs from "dayjs"
import { prisma } from "@/lib/prisma"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { calculatePayroll, getDaysInPeriod, type PayrollSummary } from "@/lib/payroll"
import type { MarkRow } from "@/lib/workday"

const qSchema = z.object({
  period:         z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM"),
  paymentCycle:   z.enum(["MONTHLY", "BIWEEKLY", "WEEKLY"]).default("MONTHLY"),
  half:           z.coerce.number().int().min(1).max(2).default(1),
  collaboratorId: z.coerce.number().int().positive().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireRole(...Permissions.COLLABORATOR_WRITE)
  if (!auth.ok) return auth.response

  const parsed = qSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { period, paymentCycle, half, collaboratorId } = parsed.data

  // ── Settings globales ──────────────────────────────────────────────────
  const settings = await prisma.companySettings.findUnique({ where: { id: 1 } })
  if (!settings) {
    return NextResponse.json({ error: "Configuración de empresa no encontrada" }, { status: 500 })
  }

  // ── Colaboradores activos ──────────────────────────────────────────────
  const collaborators = await prisma.collaborator.findMany({
    where: {
      is_active: true,
      ...(collaboratorId ? { id: collaboratorId } : {}),
    },
    include: { scheduleSpecial: true },
    orderBy: { name: "asc" },
  })

  // ── Rango de fechas del período ────────────────────────────────────────
  const allDays = getDaysInPeriod(period, paymentCycle, half as 1 | 2)
  const dateFrom = new Date(`${allDays[0]}T00:00:00.000Z`)
  const dateTo   = new Date(`${allDays[allDays.length - 1]}T23:59:59.999Z`)

  // ── Cargar horario GENERAL (fallback) ──────────────────────────────────
  const generalSchedule = await prisma.schedule.findFirst({
    where: { type: "GENERAL" },
    orderBy: { id: "asc" },
  })

  // ── Marcaciones del período (todos los colaboradores de una sola query) ─
  const collaboratorIds = collaborators.map((c) => c.id)

  const allAccesses = await prisma.access.findMany({
    where: {
      collaboratorId: { in: collaboratorIds },
      timestamp: { gte: dateFrom, lte: dateTo },
    },
    select: {
      id: true,
      collaboratorId: true,
      timestamp: true,
      markType: true,
      status: true,
    },
    orderBy: { timestamp: "asc" },
  })

  // Indexar accesses por colaboradorId → fecha → marks
  const accessIndex: Record<number, Record<string, MarkRow[]>> = {}
  for (const access of allAccesses) {
    const cid = access.collaboratorId
    const dateStr = dayjs(access.timestamp).format("YYYY-MM-DD")
    if (!accessIndex[cid]) accessIndex[cid] = {}
    if (!accessIndex[cid][dateStr]) accessIndex[cid][dateStr] = []
    accessIndex[cid][dateStr].push({
      id:        access.id,
      markType:  access.markType,
      timestamp: access.timestamp,
      status:    access.status,
    })
  }

  // ── Calcular planilla por colaborador ──────────────────────────────────
  const settingsForPayroll = {
    lateTolerance:        settings.lateTolerance,
    lunchDurationMinutes: settings.lunchDurationMinutes,
    lunchDeductionType:   settings.lunchDeductionType,
    lunchRequired:        settings.lunchRequired,
    overtimeEnabled:      settings.overtimeEnabled,
    overtimeBeforeMinutes: settings.overtimeBeforeMinutes,
    overtimeAfterMinutes:  settings.overtimeAfterMinutes,
    overtimeRoundMinutes:  settings.overtimeRoundMinutes,
    lateDiscountPolicy:   settings.lateDiscountPolicy,
    workdayHours:         settings.workdayHours,
    overtimeFactor:       settings.overtimeFactor,  // Decimal
  }

  const items: PayrollSummary[] = collaborators.map((collab) => {
    // Resolver horario: especial > general > null
    const schedule = collab.scheduleSpecial ?? generalSchedule ?? null

    const salary = collab.salary ? Number(collab.salary) : null

    const marksByDay: Record<string, MarkRow[]> = accessIndex[collab.id] ?? {}

    return calculatePayroll(
      collab.id,
      collab.name,
      salary,
      collab.paymentType as "MONTHLY" | "BIWEEKLY" | "WEEKLY" | null,
      schedule
        ? {
            startTime: schedule.startTime,
            endTime:   schedule.endTime ?? null,
            days:      schedule.days,
          }
        : null,
      marksByDay,
      settingsForPayroll,
      period,
      paymentCycle,
      half as 1 | 2,
    )
  })

  return NextResponse.json({
    period,
    paymentCycle,
    half,
    items,
    generatedAt: new Date().toISOString(),
  })
}
