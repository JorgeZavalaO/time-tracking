/**
 * useDailySummary — React Query wrapper de GET /api/access/daily-summary
 */
import { useQuery, useQueryClient } from "@tanstack/react-query"

export type WorkdaySummary = {
  entryTime:       string | null
  exitTime:        string | null
  lunchOutTime:    string | null
  lunchInTime:     string | null
  lunchMinutes:    number
  grossMinutes:    number | null
  netMinutes:      number | null
  minutesLate:     number
  overtimeMinutes: number
  isDayComplete:   boolean
  incidences:      string[]
  marks:           Array<{
    id:        number
    markType:  string
    timestamp: string
    status:    string
  }>
}

/**
 * @param collaboratorId  ID del colaborador (null suspende la query)
 * @param date            "YYYY-MM-DD"
 */
export function useDailySummary(
  collaboratorId: number | null | undefined,
  date:           string | null | undefined,
) {
  return useQuery<WorkdaySummary>({
    queryKey: ["daily-summary", collaboratorId, date],
    queryFn: async () => {
      const qs = new URLSearchParams({
        collaboratorId: String(collaboratorId),
        date:           date!,
      })
      const r = await fetch(`/api/access/daily-summary?${qs}`)
      if (!r.ok) throw await r.json()
      return r.json()
    },
    enabled: !!collaboratorId && !!date,
    staleTime: 10_000,
  })
}

/**
 * Helper para invalidar manualmente el resumen tras una edición
 */
export function useInvalidateDailySummary() {
  const qc = useQueryClient()
  return (collaboratorId: number, date: string) =>
    qc.invalidateQueries({ queryKey: ["daily-summary", collaboratorId, date] })
}
