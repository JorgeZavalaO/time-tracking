/**
 * GET  /api/payroll/snapshot  — Lista de snapshots (con filtros opcionales)
 * POST /api/payroll/snapshot  — Crea un DRAFT calculando la planilla actual
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import dayjs from "dayjs"
import { prisma } from "@/lib/prisma"
import { AuditStatus } from "@prisma/client"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"
import { calculatePayroll, getDaysInPeriod } from "@/lib/payroll"
import type { MarkRow } from "@/lib/workday"

const createSchema = z.object({
  period:       z.string().regex(/^\d{4}-\d{2}$/),
  paymentCycle: z.enum(["MONTHLY", "BIWEEKLY", "WEEKLY"]).default("MONTHLY"),
  half:         z.coerce.number().int().min(1).max(2).default(1),
})

export async function GET(req: NextRequest) {
  const auth = await requireRole(...Permissions.COLLABORATOR_WRITE)
  if (!auth.ok) return auth.response

  const period = req.nextUrl.searchParams.get("period") ?? undefined
  const status = req.nextUrl.searchParams.get("status") ?? undefined

  const snapshots = await prisma.payrollSnapshot.findMany({
    where: {
      ...(period ? { period } : {}),
      ...(status ? { status: status as "DRAFT" | "CLOSED" } : {}),
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      closedBy:  { select: { id: true, name: true } },
      _count:    { select: { adjustments: true } },
    },
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json(snapshots)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(...Permissions.COLLABORATOR_WRITE)
  if (!auth.ok) return auth.response

  const body = createSchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
  }
  const { period, paymentCycle, half } = body.data

  // Verificar que no exista ya un snapshot OPEN para ese período+ciclo+quincena
  const existing = await prisma.payrollSnapshot.findFirst({
    where: { period, paymentCycle, half, status: "DRAFT" },
  })
  if (existing) {
    return NextResponse.json(
      { error: `Ya existe un borrador para ${period} (${paymentCycle}). Ciérralo primero.` },
      { status: 409 },
    )
  }

  // ── Cargar datos (misma lógica que /api/payroll) ──────────────────────
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

  const rawItems = collaborators.map((collab) => {
    const schedule = collab.scheduleSpecial ?? generalSchedule ?? null
    const summary = calculatePayroll(
      collab.id, collab.name,
      collab.salary ? Number(collab.salary) : null,
      collab.paymentType as "MONTHLY" | "BIWEEKLY" | "WEEKLY" | null,
      schedule ? { startTime: schedule.startTime, endTime: schedule.endTime ?? null, days: schedule.days } : null,
      accessIndex[collab.id] ?? {},
      settingsForPayroll, period, paymentCycle, half as 1 | 2,
    )
    // Guardamos sin byDay para mantener el JSON ligero
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { byDay: _byDay, ...withoutByDay } = summary
    return withoutByDay
  })

  const totalNet = rawItems.reduce((a, r) => a + r.totalNet, 0)

  // Guardar snapshot en settings para auditoría
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createdAt: _ca, updatedAt: _ua, ...settingsSnapshot } = settings

  const snapshot = await prisma.payrollSnapshot.create({
    data: {
      period,
      paymentCycle,
      half,
      status:          "DRAFT",
      items:           rawItems,
      settingsSnapshot,
      totalNet,
      createdById:     auth.userId,
    },
  })

  await logAudit({
    actorId:    auth.userId,
    actorRole:  auth.role,
    action:     "CREATE",
    resource:   "PAYROLL_SNAPSHOT",
    resourceId: snapshot.id,
    status:     AuditStatus.SUCCESS,
    after:      { period, paymentCycle, half, collaborators: rawItems.length },
  })

  return NextResponse.json(snapshot, { status: 201 })
}
