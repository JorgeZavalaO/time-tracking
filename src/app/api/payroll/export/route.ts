/**
 * GET /api/payroll/export
 * Genera y descarga un archivo .xlsx con la pre-planilla del período.
 *
 * Query params (igual que /api/payroll):
 *   period         "YYYY-MM"
 *   paymentCycle   "MONTHLY" | "BIWEEKLY" | "WEEKLY"
 *   half           1 | 2
 *   collaboratorId number (opcional)
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import dayjs from "dayjs"
import * as XLSX from "xlsx"
import { prisma } from "@/lib/prisma"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { calculatePayroll, getDaysInPeriod } from "@/lib/payroll"
import type { MarkRow } from "@/lib/workday"
import { formatMinutes } from "@/lib/workday"

const qSchema = z.object({
  period:         z.string().regex(/^\d{4}-\d{2}$/),
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

  // ── Reutilizamos misma lógica de carga que /api/payroll ──────────────────
  const settings = await prisma.companySettings.findUnique({ where: { id: 1 } })
  if (!settings) {
    return NextResponse.json({ error: "Configuración no encontrada" }, { status: 500 })
  }

  const collaborators = await prisma.collaborator.findMany({
    where: {
      is_active: true,
      ...(collaboratorId ? { id: collaboratorId } : {}),
    },
    include: { scheduleSpecial: true },
    orderBy: { name: "asc" },
  })

  const allDays = getDaysInPeriod(period, paymentCycle, half as 1 | 2)
  const dateFrom = new Date(`${allDays[0]}T00:00:00.000Z`)
  const dateTo   = new Date(`${allDays[allDays.length - 1]}T23:59:59.999Z`)

  const generalSchedule = await prisma.schedule.findFirst({
    where: { type: "GENERAL" },
    orderBy: { id: "asc" },
  })

  const allAccesses = await prisma.access.findMany({
    where: {
      collaboratorId: { in: collaborators.map((c) => c.id) },
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

  const settingsForPayroll = {
    lateTolerance:         settings.lateTolerance,
    lunchDurationMinutes:  settings.lunchDurationMinutes,
    lunchDeductionType:    settings.lunchDeductionType,
    lunchRequired:         settings.lunchRequired,
    overtimeEnabled:       settings.overtimeEnabled,
    overtimeBeforeMinutes: settings.overtimeBeforeMinutes,
    overtimeAfterMinutes:  settings.overtimeAfterMinutes,
    overtimeRoundMinutes:  settings.overtimeRoundMinutes,
    lateDiscountPolicy:    settings.lateDiscountPolicy,
    workdayHours:          settings.workdayHours,
    overtimeFactor:        settings.overtimeFactor,
  }

  const items = collaborators.map((collab) => {
    const schedule = collab.scheduleSpecial ?? generalSchedule ?? null
    const salary   = collab.salary ? Number(collab.salary) : null
    return calculatePayroll(
      collab.id,
      collab.name,
      salary,
      collab.paymentType as "MONTHLY" | "BIWEEKLY" | "WEEKLY" | null,
      schedule ? { startTime: schedule.startTime, endTime: schedule.endTime ?? null, days: schedule.days } : null,
      accessIndex[collab.id] ?? {},
      settingsForPayroll,
      period,
      paymentCycle,
      half as 1 | 2,
    )
  })

  // ── Construir workbook ────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()

  // Sheet 1 — Resumen
  const summaryHeaders = [
    "Colaborador", "Días programados", "Días trabajados",
    "Tard. total (min)", "Descuento tard. (S/)",
    "H.E. total (min)", "Pago H.E. (S/)",
    "Sueldo base (S/)", "Total neto (S/)",
  ]
  const summaryRows = items.map((r) => [
    r.collaboratorName,
    r.scheduledDays,
    r.workedDays,
    r.totalMinutesLate,
    r.totalLateDiscount,
    r.totalOvertimeMinutes,
    r.totalOvertimePay,
    r.baseSalary,
    r.totalNet,
  ])
  // Totals row
  const totals = [
    "TOTAL",
    items.reduce((a, r) => a + r.scheduledDays, 0),
    items.reduce((a, r) => a + r.workedDays, 0),
    items.reduce((a, r) => a + r.totalMinutesLate, 0),
    parseFloat(items.reduce((a, r) => a + r.totalLateDiscount, 0).toFixed(2)),
    items.reduce((a, r) => a + r.totalOvertimeMinutes, 0),
    parseFloat(items.reduce((a, r) => a + r.totalOvertimePay, 0).toFixed(2)),
    parseFloat(items.reduce((a, r) => a + r.baseSalary, 0).toFixed(2)),
    parseFloat(items.reduce((a, r) => a + r.totalNet, 0).toFixed(2)),
  ]

  const wsResumen = XLSX.utils.aoa_to_sheet([
    summaryHeaders,
    ...summaryRows,
    totals,
  ])
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen")

  // Sheet 2 — Detalle (una fila por colaborador × día)
  const detailHeaders = [
    "Colaborador", "Fecha", "Día", "¿Día prog.?", "¿Jornada completa?",
    "Tard. (min)", "H.E. (min)", "Neto trab.", "Desc. tard. (S/)", "Pago H.E. (S/)",
    "Incidencias",
  ]
  const detailRows: unknown[][] = []
  for (const item of items) {
    for (const d of item.byDay) {
      detailRows.push([
        item.collaboratorName,
        d.date,
        d.dayOfWeek,
        d.isScheduledDay ? "Sí" : "No",
        d.isDayComplete ? "Sí" : "No",
        d.minutesLate,
        d.overtimeMinutes,
        formatMinutes(d.netMinutes),
        d.lateDiscountAmount,
        d.overtimeAmount,
        d.incidences.join(" | "),
      ])
    }
  }

  const wsDetalle = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows])
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle")

  // ── Generar buffer y devolver ─────────────────────────────────────────────
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
  const body = new Uint8Array(buf)

  const filename = `planilla_${period}_${paymentCycle.toLowerCase()}.xlsx`

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
