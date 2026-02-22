/**
 * Motor de jornada — cálculo puro de métricas diarias.
 * Recibe marcaciones del día + configuración y devuelve WorkdaySummary.
 * Sin efectos secundarios (no escribe en DB).
 */
import dayjs, { Dayjs } from "dayjs"
import type { MarkType, CompanySettings, Schedule } from "@prisma/client"

// ─── Tipos públicos ────────────────────────────────────────────────────────

export type MarkRow = {
  id:        number
  markType:  MarkType
  timestamp: Date
  status:    string
}

export type WorkdaySummary = {
  /** Timestamp real de la ENTRY (null si no marcó) */
  entryTime:    Dayjs | null
  /** Timestamp real del EXIT (null si no marcó) */
  exitTime:     Dayjs | null
  /** Timestamp LUNCH_OUT (null si no hay) */
  lunchOutTime: Dayjs | null
  /** Timestamp LUNCH_IN (null si no hay) */
  lunchInTime:  Dayjs | null

  /** Minutos de almuerzo descontados (real o fijo según política) */
  lunchMinutes: number
  /** Minutos brutos: exitTime − entryTime (null si falta alguno) */
  grossMinutes: number | null
  /** Minutos netos: grossMinutes − lunchMinutes (null si falta grossMinutes) */
  netMinutes:   number | null

  /**
   * Minutos de tardanza (>0 = tarde, 0 = a tiempo o sin ENTRY).
   * Usa la tolerancia configurada.
   */
  minutesLate: number

  /** Minutos de horas extra (0 si overtimeEnabled=false) */
  overtimeMinutes: number

  /** Jornada considerada completa (tiene ENTRY + EXIT, sin INCIDENCE crítica) */
  isDayComplete: boolean

  /** Razones de incidencia, en orden */
  incidences: string[]

  /** Marcaciones raw de entrada para el componente */
  marks: MarkRow[]
}

// ─── Helper ───────────────────────────────────────────────────────────────

function timeToday(hhmm: string, ref: Dayjs): Dayjs {
  const [h, m] = hhmm.split(":").map(Number)
  return ref.hour(h).minute(m).second(0).millisecond(0)
}

function roundDown(minutes: number, roundTo: number): number {
  if (roundTo <= 0) return minutes
  return Math.floor(minutes / roundTo) * roundTo
}

// ─── Función principal ─────────────────────────────────────────────────────

export function calculateWorkday(
  marks:    MarkRow[],
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
  >,
  schedule: Pick<Schedule, "startTime">,
): WorkdaySummary {
  const sorted = [...marks].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  const incidences: string[] = []

  // ── Extraer marcas clave ──────────────────────────────────────────────────
  const entryMark    = sorted.find((m) => m.markType === "ENTRY")
  const exitMark     = [...sorted].reverse().find((m) => m.markType === "EXIT")
  const lunchOutMark = sorted.find((m) => m.markType === "LUNCH_OUT")
  const lunchInMark  = sorted.find((m) => m.markType === "LUNCH_IN")
  const incidenceMks = sorted.filter((m) => m.markType === "INCIDENCE")

  const entryTime    = entryMark    ? dayjs(entryMark.timestamp)    : null
  const exitTime     = exitMark     ? dayjs(exitMark.timestamp)     : null
  const lunchOutTime = lunchOutMark ? dayjs(lunchOutMark.timestamp) : null
  const lunchInTime  = lunchInMark  ? dayjs(lunchInMark.timestamp)  : null

  // ── Incidencias externas ──────────────────────────────────────────────────
  if (incidenceMks.length > 0) {
    incidences.push(`${incidenceMks.length} marcación(es) extra fuera de jornada`)
  }
  if (!entryMark) {
    incidences.push("Sin registro de entrada")
  }
  if (!exitMark && entryMark) {
    incidences.push("Jornada sin cierre (falta salida)")
  }
  if (lunchOutMark && !lunchInMark) {
    incidences.push("Almuerzo sin regreso registrado")
  }

  // ── Tardanza ──────────────────────────────────────────────────────────────
  let minutesLate = 0
  if (entryTime) {
    const ref      = entryTime
    const cutoff   = timeToday(schedule.startTime, ref)
    const cutoffOk = cutoff.add(settings.lateTolerance, "minute")
    minutesLate = Math.max(0, entryTime.diff(cutoffOk, "minute"))
    if (minutesLate > 0) {
      incidences.push(`Tardanza: ${minutesLate} min`)
    }
  }

  // ── Almuerzo ──────────────────────────────────────────────────────────────
  let lunchMinutes = 0
  if (lunchOutTime) {
    if (settings.lunchDeductionType === "REAL_TIME" && lunchInTime) {
      lunchMinutes = lunchInTime.diff(lunchOutTime, "minute")
    } else {
      // FIXED o sin regreso → deducción fija
      lunchMinutes = settings.lunchDurationMinutes
    }
  } else if (settings.lunchRequired) {
    // Almuerzo requerido pero no marcado → aplicar deducción fija de todas formas
    lunchMinutes = settings.lunchDurationMinutes
  }

  // ── Horas brutas y netas ──────────────────────────────────────────────────
  const grossMinutes =
    entryTime && exitTime ? exitTime.diff(entryTime, "minute") : null

  const netMinutes =
    grossMinutes !== null ? Math.max(0, grossMinutes - lunchMinutes) : null

  // ── Horas extra ───────────────────────────────────────────────────────────
  let overtimeMinutes = 0
  if (settings.overtimeEnabled && entryTime && exitTime) {
    const ref         = entryTime
    const schedStart  = timeToday(schedule.startTime, ref)
    // Estrictamente: horas extra = tiempo que excede lo esperado
    // Simplificamos: overtime = max(0, netMinutes - 480) pero usando los parámetros
    const earlyMinutes = Math.max(0, schedStart.diff(entryTime, "minute") - settings.overtimeBeforeMinutes)
    // Para horas extra al final necesitaríamos el endTime del schedule (no existe aún)
    // Por ahora solo contamos early overtime
    const raw = earlyMinutes
    overtimeMinutes = roundDown(raw, settings.overtimeRoundMinutes)
  }

  // ── ¿Jornada completa? ────────────────────────────────────────────────────
  const isDayComplete = !!entryMark && !!exitMark

  return {
    entryTime,
    exitTime,
    lunchOutTime,
    lunchInTime,
    lunchMinutes,
    grossMinutes,
    netMinutes,
    minutesLate,
    overtimeMinutes,
    isDayComplete,
    incidences,
    marks: sorted,
  }
}

// ─── Formateo de duración ──────────────────────────────────────────────────

export function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes < 0) return "—"
  if (minutes === 0) return "0 min"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}
