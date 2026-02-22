/**
 * Helper de carga de datos compartido por todas las rutas de informes.
 * Carga colaboradores, horario general, settings y accesos del período.
 */
import dayjs from "dayjs"
import { prisma } from "@/lib/prisma"
import { calculateWorkday } from "./workday"
import type { MarkRow } from "./workday"
import type { CompanySettings } from "@prisma/client"

// ─── Tipos de resultado ────────────────────────────────────────────────────

export type DaySummaryForReport = {
  date: string
  isScheduledDay: boolean
  isDayComplete: boolean
  minutesLate: number
  overtimeMinutes: number
  netMinutes: number | null
  incidences: string[]
}

export type CollaboratorReportData = {
  collaboratorId: number
  collaboratorName: string
  position: string | null
  byDay: DaySummaryForReport[]
}

// ─── Función de carga ──────────────────────────────────────────────────────

export async function loadReportData(
  dateFrom: string,
  dateTo: string,
  collaboratorId?: number,
): Promise<{
  data: CollaboratorReportData[]
  settings: CompanySettings
}> {
  const [settings, collaborators, generalSchedule] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: 1 } }),
    prisma.collaborator.findMany({
      where: {
        is_active: true,
        ...(collaboratorId ? { id: collaboratorId } : {}),
      },
      include: { scheduleSpecial: true },
      orderBy: { name: "asc" },
    }),
    prisma.schedule.findFirst({
      where: { type: "GENERAL" },
      orderBy: { id: "asc" },
    }),
  ])

  if (!settings) throw new Error("Configuración no encontrada")

  const from = new Date(`${dateFrom}T00:00:00.000Z`)
  const to   = new Date(`${dateTo}T23:59:59.999Z`)

  const allAccesses = await prisma.access.findMany({
    where: {
      collaboratorId: { in: collaborators.map((c) => c.id) },
      timestamp: { gte: from, lte: to },
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

  // Indexar por collaboratorId → fecha
  const accessIndex: Record<number, Record<string, MarkRow[]>> = {}
  for (const a of allAccesses) {
    const cid     = a.collaboratorId
    const dateStr = dayjs(a.timestamp).format("YYYY-MM-DD")
    if (!accessIndex[cid])         accessIndex[cid] = {}
    if (!accessIndex[cid][dateStr]) accessIndex[cid][dateStr] = []
    accessIndex[cid][dateStr].push({
      id:        a.id,
      markType:  a.markType,
      timestamp: a.timestamp,
      status:    a.status,
    })
  }

  // Construir rango de fechas
  const days: string[] = []
  let cur = dayjs(dateFrom)
  const end = dayjs(dateTo)
  while (!cur.isAfter(end)) {
    days.push(cur.format("YYYY-MM-DD"))
    cur = cur.add(1, "day")
  }

  const settingsForWorkday = {
    lateTolerance:         settings.lateTolerance,
    lunchDurationMinutes:  settings.lunchDurationMinutes,
    lunchDeductionType:    settings.lunchDeductionType,
    lunchRequired:         settings.lunchRequired,
    overtimeEnabled:       settings.overtimeEnabled,
    overtimeBeforeMinutes: settings.overtimeBeforeMinutes,
    overtimeAfterMinutes:  settings.overtimeAfterMinutes,
    overtimeRoundMinutes:  settings.overtimeRoundMinutes,
  }

  const data: CollaboratorReportData[] = collaborators.map((collab) => {
    const schedule = collab.scheduleSpecial ?? generalSchedule ?? null
    const scheduleDays: string[] = schedule
      ? Array.isArray(schedule.days)
        ? schedule.days
        : (schedule.days as string).split(",").map((d) => d.trim())
      : []

    const byDay: DaySummaryForReport[] = days.map((dateStr) => {
      const domAbbr      = dayjs(dateStr).format("ddd").toUpperCase().slice(0, 3)
      const isScheduledDay = scheduleDays.includes(domAbbr)
      const marks: MarkRow[] = accessIndex[collab.id]?.[dateStr] ?? []

      if (marks.length === 0) {
        return {
          date: dateStr,
          isScheduledDay,
          isDayComplete: false,
          minutesLate: 0,
          overtimeMinutes: 0,
          netMinutes: null,
          incidences: isScheduledDay ? ["Sin registros de asistencia"] : [],
        }
      }

      const summary = calculateWorkday(
        marks,
        settingsForWorkday,
        schedule
          ? { startTime: schedule.startTime, endTime: schedule.endTime ?? null }
          : { startTime: "08:00", endTime: null },
      )

      return {
        date: dateStr,
        isScheduledDay,
        isDayComplete: summary.isDayComplete,
        minutesLate: summary.minutesLate,
        overtimeMinutes: summary.overtimeMinutes,
        netMinutes: summary.netMinutes,
        incidences: summary.incidences,
      }
    })

    return {
      collaboratorId:   collab.id,
      collaboratorName: collab.name,
      position:         collab.position ?? null,
      byDay,
    }
  })

  return { data, settings }
}
