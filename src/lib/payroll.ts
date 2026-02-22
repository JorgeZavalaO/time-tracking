/**
 * Motor de nómina — cálculo puro de pre-planilla.
 * Sin efectos secundarios (no escribe en DB).
 *
 * Calcula descuentos por tardanza y pago de horas extra
 * por colaborador en un período (MONTHLY / BIWEEKLY).
 */
import dayjs from "dayjs"
import type { CompanySettings, Schedule } from "@prisma/client"
import { calculateWorkday, type MarkRow } from "./workday"

// ─── Tipos públicos ────────────────────────────────────────────────────────

export type PayrollDaySummary = {
  /** Fecha en formato "YYYY-MM-DD" */
  date: string
  /** Día de semana abreviado ("MON", "TUE", ...) */
  dayOfWeek: string
  /** Si ese día está incluido en el horario del colaborador */
  isScheduledDay: boolean
  /** Si la jornada quedó completa (ENTRY + EXIT) */
  isDayComplete: boolean
  /** Minutos de tardanza */
  minutesLate: number
  /** Minutos de horas extra */
  overtimeMinutes: number
  /** Minutos netos trabajados */
  netMinutes: number | null
  /** Monto a descontar por tardanza (en moneda local) */
  lateDiscountAmount: number
  /** Monto extra a pagar por H.E. */
  overtimeAmount: number
  /** Lista de incidencias del día */
  incidences: string[]
}

export type PayrollSummary = {
  collaboratorId: number
  collaboratorName: string
  /** "YYYY-MM" */
  period: string
  paymentCycle: "MONTHLY" | "BIWEEKLY" | "WEEKLY"
  /** Sueldo base para el período (fracción si BIWEEKLY) */
  baseSalary: number
  /** Tarifa/hora calculada = salary / (scheduledDays × workdayHours) */
  hourlyRate: number
  /** Días hábiles esperados en el período según horario */
  scheduledDays: number
  /** Días con al menos una marcación de ENTRY */
  workedDays: number
  totalMinutesLate: number
  totalLateDiscount: number
  totalOvertimeMinutes: number
  totalOvertimePay: number
  /** baseSalary − lateDiscount + overtimePay */
  totalNet: number
  byDay: PayrollDaySummary[]
}

// ─── Helpers internos ──────────────────────────────────────────────────────

/** Devuelve el nombre de día abreviado en formato "MON","TUE",... */
function getDayAbbr(dateStr: string): string {
  return dayjs(dateStr).format("ddd").toUpperCase().slice(0, 3)
}

/** Lista de fechas "YYYY-MM-DD" para el período */
export function getDaysInPeriod(
  period: string,
  paymentCycle: "MONTHLY" | "BIWEEKLY" | "WEEKLY",
  half: 1 | 2 = 1,
): string[] {
  const [year, month] = period.split("-").map(Number)
  const start = dayjs(new Date(year, month - 1, 1))
  const endOfMonth = start.endOf("month")
  const days: string[] = []

  if (paymentCycle === "MONTHLY") {
    let cur = start
    while (!cur.isAfter(endOfMonth)) {
      days.push(cur.format("YYYY-MM-DD"))
      cur = cur.add(1, "day")
    }
  } else if (paymentCycle === "BIWEEKLY") {
    const rangeStart = half === 1 ? start : start.date(16)
    const rangeEnd = half === 1 ? start.date(15) : endOfMonth
    let cur = rangeStart
    while (!cur.isAfter(rangeEnd)) {
      days.push(cur.format("YYYY-MM-DD"))
      cur = cur.add(1, "day")
    }
  } else {
    // WEEKLY: 7 días empezando el 1ro del período
    for (let i = 0; i < 7; i++) {
      days.push(start.add(i, "day").format("YYYY-MM-DD"))
    }
  }
  return days
}

// ─── Función principal ─────────────────────────────────────────────────────

/**
 * Calcula la pre-planilla de un colaborador.
 *
 * @param collaboratorId   ID del colaborador
 * @param collaboratorName Nombre del colaborador
 * @param salary           Sueldo mensual declarado
 * @param paymentType      Ciclo de pago del colaborador
 * @param schedule         Horario asignado (o null si no tiene)
 * @param marksByDay       Marcaciones agrupadas por fecha "YYYY-MM-DD"
 * @param settings         Configuración de empresa
 * @param period           "YYYY-MM"
 * @param paymentCycle     Ciclo a liquidar (puede diferir de paymentType si se fuerza)
 * @param half             Para BIWEEKLY: 1 = primera quincena, 2 = segunda
 */
export function calculatePayroll(
  collaboratorId: number,
  collaboratorName: string,
  salary: number | null,
  paymentType: "MONTHLY" | "BIWEEKLY" | "WEEKLY" | null,
  schedule: Pick<Schedule, "startTime" | "endTime" | "days"> | null,
  marksByDay: Record<string, MarkRow[]>,
  settings: Pick<
    CompanySettings,
    | "lateTolerance"
    | "lunchDurationMinutes"
    | "lunchDeductionType"
    | "lunchRequired"
    | "overtimeEnabled"
    | "overtimeBeforeMinutes"
    | "overtimeAfterMinutes"
    | "overtimeRoundMinutes"
    | "lateDiscountPolicy"
    | "workdayHours"
    | "overtimeFactor"
  >,
  period: string,
  paymentCycle: "MONTHLY" | "BIWEEKLY" | "WEEKLY" = "MONTHLY",
  half: 1 | 2 = 1,
): PayrollSummary {
  const cycle = paymentType ?? paymentCycle
  const allDays = getDaysInPeriod(period, cycle, half)

  // ── Días hábiles programados ──────────────────────────────────────────────
  const scheduleDays: string[] = schedule
    ? (Array.isArray(schedule.days)
        ? schedule.days
        : (schedule.days as string).split(",").map((d) => d.trim()))
    : []

  const scheduledDays = allDays.filter((d) => scheduleDays.includes(getDayAbbr(d))).length

  // ── Tarifa/hora ───────────────────────────────────────────────────────────
  // Dividimos el sueldo mensual entre los días esperados × horas/jornada
  // Si no hay horario ni sueldo definidos, la tarifa queda en 0
  const monthlySalary = salary ?? 0
  // Siempre calculamos sobre el sueldo mensual (aunque el ciclo sea BIWEEKLY)
  const hourlyRate =
    scheduledDays > 0 && settings.workdayHours > 0
      ? monthlySalary / (scheduledDays * settings.workdayHours)
      : 0

  // Sueldo base del período (fracción si es quincena)
  const baseSalary =
    cycle === "MONTHLY"
      ? monthlySalary
      : cycle === "BIWEEKLY"
      ? monthlySalary / 2
      : monthlySalary / 4 // WEEKLY ≈ 1/4 del mensual (approx)

  // ── Cálculo por día ───────────────────────────────────────────────────────
  const fallbackSchedule: Pick<Schedule, "startTime" | "endTime"> = {
    startTime: "08:00",
    endTime: null,
  }

  const byDay: PayrollDaySummary[] = allDays.map((dateStr) => {
    const dayOfWeek = getDayAbbr(dateStr)
    const isScheduledDay = scheduleDays.includes(dayOfWeek)
    const dayMarks: MarkRow[] = marksByDay[dateStr] ?? []

    // Sin marcaciones → jornada vacía
    if (dayMarks.length === 0) {
      const incidences: string[] = []
      if (isScheduledDay) incidences.push("Sin registros de asistencia")
      return {
        date: dateStr,
        dayOfWeek,
        isScheduledDay,
        isDayComplete: false,
        minutesLate: 0,
        overtimeMinutes: 0,
        netMinutes: null,
        lateDiscountAmount: 0,
        overtimeAmount: 0,
        incidences,
      }
    }

    const sch = schedule ?? fallbackSchedule
    const summary = calculateWorkday(dayMarks, settings, sch)

    // ── Descuento por tardanza (BY_MINUTE) ────────────────────────────────
    let lateDiscountAmount = 0
    if (settings.lateDiscountPolicy === "BY_MINUTE" && summary.minutesLate > 0) {
      lateDiscountAmount = parseFloat(
        ((summary.minutesLate / 60) * hourlyRate).toFixed(2),
      )
    }

    // ── Monto H.E. ────────────────────────────────────────────────────────
    const overtimeFactor = Number(settings.overtimeFactor) // Decimal → number
    const overtimeAmount = parseFloat(
      ((summary.overtimeMinutes / 60) * hourlyRate * overtimeFactor).toFixed(2),
    )

    return {
      date: dateStr,
      dayOfWeek,
      isScheduledDay,
      isDayComplete: summary.isDayComplete,
      minutesLate: summary.minutesLate,
      overtimeMinutes: summary.overtimeMinutes,
      netMinutes: summary.netMinutes,
      lateDiscountAmount,
      overtimeAmount,
      incidences: summary.incidences,
    }
  })

  // ── Totales ───────────────────────────────────────────────────────────────
  const workedDays = byDay.filter((d) => d.isDayComplete).length
  const totalMinutesLate = byDay.reduce((acc, d) => acc + d.minutesLate, 0)
  const totalLateDiscount = parseFloat(
    byDay.reduce((acc, d) => acc + d.lateDiscountAmount, 0).toFixed(2),
  )
  const totalOvertimeMinutes = byDay.reduce((acc, d) => acc + d.overtimeMinutes, 0)
  const totalOvertimePay = parseFloat(
    byDay.reduce((acc, d) => acc + d.overtimeAmount, 0).toFixed(2),
  )
  const totalNet = parseFloat(
    (baseSalary - totalLateDiscount + totalOvertimePay).toFixed(2),
  )

  return {
    collaboratorId,
    collaboratorName,
    period,
    paymentCycle: cycle,
    baseSalary,
    hourlyRate: parseFloat(hourlyRate.toFixed(4)),
    scheduledDays,
    workedDays,
    totalMinutesLate,
    totalLateDiscount,
    totalOvertimeMinutes,
    totalOvertimePay,
    totalNet,
    byDay,
  }
}
