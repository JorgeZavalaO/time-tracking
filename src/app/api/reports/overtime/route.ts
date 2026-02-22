/**
 * GET /api/reports/overtime
 * Horas extra por colaborador en un período.
 * Reutiliza calculatePayroll() para los cálculos.
 *
 * Query params:
 *   period        "YYYY-MM" (requerido)
 *   paymentCycle  "MONTHLY" | "BIWEEKLY" | "WEEKLY" (default: MONTHLY)
 *   half          1 | 2 (default: 1)
 *   format        "json" | "xlsx" | "pdf"
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import dayjs from "dayjs"
import { prisma } from "@/lib/prisma"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { calculatePayroll, getDaysInPeriod } from "@/lib/payroll"
import { toXlsx, toPdf } from "@/lib/export"
import { formatMinutes } from "@/lib/workday"
import type { MarkRow } from "@/lib/workday"

const qSchema = z.object({
  period:       z.string().regex(/^\d{4}-\d{2}$/),
  paymentCycle: z.enum(["MONTHLY", "BIWEEKLY", "WEEKLY"]).default("MONTHLY"),
  half:         z.coerce.number().int().min(1).max(2).default(1),
  format:       z.enum(["json", "xlsx", "pdf"]).default("json"),
})

export async function GET(req: NextRequest) {
  const auth = await requireRole(...Permissions.COLLABORATOR_READ)
  if (!auth.ok) return auth.response

  const parsed = qSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { period, paymentCycle, half, format } = parsed.data

  const [settings, collaborators, generalSchedule] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: 1 } }),
    prisma.collaborator.findMany({
      where: { is_active: true },
      include: { scheduleSpecial: true },
      orderBy: { name: "asc" },
    }),
    prisma.schedule.findFirst({ where: { type: "GENERAL" }, orderBy: { id: "asc" } }),
  ])

  if (!settings) {
    return NextResponse.json({ error: "Configuración no encontrada" }, { status: 500 })
  }

  const allDays  = getDaysInPeriod(period, paymentCycle, half as 1 | 2)
  const dateFrom = new Date(`${allDays[0]}T00:00:00.000Z`)
  const dateTo   = new Date(`${allDays[allDays.length - 1]}T23:59:59.999Z`)

  const allAccesses = await prisma.access.findMany({
    where: {
      collaboratorId: { in: collaborators.map((c) => c.id) },
      timestamp: { gte: dateFrom, lte: dateTo },
    },
    select: { id: true, collaboratorId: true, timestamp: true, markType: true, status: true },
    orderBy: { timestamp: "asc" },
  })

  const accessIndex: Record<number, Record<string, MarkRow[]>> = {}
  for (const a of allAccesses) {
    const cid = a.collaboratorId
    const dateStr = dayjs(a.timestamp).format("YYYY-MM-DD")
    if (!accessIndex[cid]) accessIndex[cid] = {}
    if (!accessIndex[cid][dateStr]) accessIndex[cid][dateStr] = []
    accessIndex[cid][dateStr].push({ id: a.id, markType: a.markType, timestamp: a.timestamp, status: a.status })
  }

  const settingsForPayroll = {
    lateTolerance: settings.lateTolerance,
    lunchDurationMinutes: settings.lunchDurationMinutes,
    lunchDeductionType: settings.lunchDeductionType,
    lunchRequired: settings.lunchRequired,
    overtimeEnabled: settings.overtimeEnabled,
    overtimeBeforeMinutes: settings.overtimeBeforeMinutes,
    overtimeAfterMinutes: settings.overtimeAfterMinutes,
    overtimeRoundMinutes: settings.overtimeRoundMinutes,
    lateDiscountPolicy: settings.lateDiscountPolicy,
    workdayHours: settings.workdayHours,
    overtimeFactor: settings.overtimeFactor,
  }

  const items = collaborators
    .map((collab) => {
      const schedule = collab.scheduleSpecial ?? generalSchedule ?? null
      const summary = calculatePayroll(
        collab.id, collab.name,
        collab.salary ? Number(collab.salary) : null,
        collab.paymentType as "MONTHLY" | "BIWEEKLY" | "WEEKLY" | null,
        schedule ? { startTime: schedule.startTime, endTime: schedule.endTime ?? null, days: schedule.days } : null,
        accessIndex[collab.id] ?? {},
        settingsForPayroll, period, paymentCycle, half as 1 | 2,
      )
      const daysWithOT = summary.byDay.filter((d) => d.overtimeMinutes > 0).length
      return {
        collaboratorId:       collab.id,
        collaboratorName:     collab.name,
        position:             collab.position ?? null,
        daysWithOvertime:     daysWithOT,
        totalOvertimeMinutes: summary.totalOvertimeMinutes,
        totalOvertimePay:     summary.totalOvertimePay,
        hourlyRate:           summary.hourlyRate,
      }
    })
    .filter((item) => item.totalOvertimeMinutes > 0)
    .sort((a, b) => b.totalOvertimeMinutes - a.totalOvertimeMinutes)

  if (format === "json") {
    return NextResponse.json({ period, paymentCycle, items })
  }

  const headers = [
    "Colaborador", "Cargo", "Días con H.E.", "H.E. total", "Monto H.E. (S/)", "Tarifa/hora (S/)",
  ]
  const rows = items.map((r) => [
    r.collaboratorName, r.position ?? "—",
    r.daysWithOvertime, formatMinutes(r.totalOvertimeMinutes),
    r.totalOvertimePay.toFixed(2), r.hourlyRate.toFixed(4),
  ])
  const title = `Horas extra — ${period}`

  if (format === "xlsx") {
    const body = toXlsx([{ name: "Horas Extra", headers, rows }])
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="horas_extra_${period}.xlsx"`,
      },
    })
  }

  const buf = await toPdf(title, [{ name: "Horas extra", headers, rows }])
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="horas_extra_${period}.pdf"`,
    },
  })
}
