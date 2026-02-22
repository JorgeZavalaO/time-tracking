/**
 * Hooks para los 4 reportes de asistencia.
 * Todos usan TanStack Query con enabled=false por defecto
 * para que la UI controle cuándo disparar la carga.
 */
import { useQuery, useMutation } from "@tanstack/react-query"

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AttendanceReportItem {
  collaboratorId:   number
  collaboratorName: string
  position:         string
  scheduledDays:    number
  presentDays:      number
  absentDays:       number
  totalNetMinutes:  number
  attendancePct:    number
}
export interface AttendanceReport {
  dateFrom: string
  dateTo:   string
  items:    AttendanceReportItem[]
}

export interface TardinessReportItem {
  rank:                  number
  collaboratorId:        number
  collaboratorName:      string
  position:              string
  daysLate:              number
  totalMinutesLate:      number
  avgMinutesPerLateDay:  number
  maxSingleDayLate:      number
  detailByDay:           { date: string; minutesLate: number }[]
}
export interface TardinessReport {
  dateFrom: string
  dateTo:   string
  items:    TardinessReportItem[]
}

export interface OvertimeReportItem {
  collaboratorId:       number
  collaboratorName:     string
  position:             string
  daysWithOvertime:     number
  totalOvertimeMinutes: number
  totalOvertimePay:     number
  hourlyRate:           number
}
export interface OvertimeReport {
  period:      string
  paymentCycle: string
  half?:        number
  items:        OvertimeReportItem[]
}

export interface IncidenceDetail { date: string; incidences: string[] }
export interface IncidencesReportItem {
  collaboratorId:       number
  collaboratorName:     string
  position:             string
  daysWithIncidences:   number
  totalIncidences:      number
  detail:               IncidenceDetail[]
}
export interface IncidencesReport {
  dateFrom: string
  dateTo:   string
  items:    IncidencesReportItem[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

async function downloadFile(url: string, filename: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Error al generar el archivo")
  const blob = await res.blob()
  const href  = URL.createObjectURL(blob)
  const link  = document.createElement("a")
  link.href     = href
  link.download = filename
  link.click()
  URL.revokeObjectURL(href)
}

// ─── Asistencia ────────────────────────────────────────────────────────────

export function useAttendanceReport(
  dateFrom: string,
  dateTo: string,
  collaboratorId?: number,
  enabled = false,
) {
  const params  = new URLSearchParams({ dateFrom, dateTo, format: "json" })
  if (collaboratorId) params.set("collaboratorId", String(collaboratorId))
  return useQuery<AttendanceReport>({
    queryKey: ["report", "attendance", dateFrom, dateTo, collaboratorId],
    queryFn:  () => fetchJson(`/api/reports/attendance?${params}`),
    enabled:  enabled && Boolean(dateFrom && dateTo),
  })
}

// ─── Tardanzas ─────────────────────────────────────────────────────────────

export function useTardinessReport(dateFrom: string, dateTo: string, enabled = false) {
  return useQuery<TardinessReport>({
    queryKey: ["report", "tardiness", dateFrom, dateTo],
    queryFn:  () => fetchJson(`/api/reports/tardiness?dateFrom=${dateFrom}&dateTo=${dateTo}&format=json`),
    enabled:  enabled && Boolean(dateFrom && dateTo),
  })
}

// ─── Horas extra ───────────────────────────────────────────────────────────

export function useOvertimeReport(
  period: string,
  paymentCycle: string,
  half?: number,
  enabled = false,
) {
  const params = new URLSearchParams({ period, paymentCycle, format: "json" })
  if (half) params.set("half", String(half))
  return useQuery<OvertimeReport>({
    queryKey: ["report", "overtime", period, paymentCycle, half],
    queryFn:  () => fetchJson(`/api/reports/overtime?${params}`),
    enabled:  enabled && Boolean(period && paymentCycle),
  })
}

// ─── Incidencias ───────────────────────────────────────────────────────────

export function useIncidencesReport(dateFrom: string, dateTo: string, enabled = false) {
  return useQuery<IncidencesReport>({
    queryKey: ["report", "incidences", dateFrom, dateTo],
    queryFn:  () => fetchJson(`/api/reports/incidences?dateFrom=${dateFrom}&dateTo=${dateTo}&format=json`),
    enabled:  enabled && Boolean(dateFrom && dateTo),
  })
}

// ─── Export genérico ───────────────────────────────────────────────────────

type ReportType = "attendance" | "tardiness" | "overtime" | "incidences"

export function useExportReport() {
  return useMutation({
    mutationFn: async ({
      type,
      params,
      format,
    }: {
      type:   ReportType
      params: Record<string, string | number | undefined>
      format: "xlsx" | "pdf"
    }) => {
      const sp = new URLSearchParams({ format })
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") sp.set(k, String(v))
      }
      const ext = format === "xlsx" ? "xlsx" : "pdf"
      await downloadFile(`/api/reports/${type}?${sp}`, `informe-${type}-${new Date().toISOString().slice(0, 10)}.${ext}`)
    },
  })
}
