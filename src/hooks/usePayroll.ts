import { useQuery, useMutation } from "@tanstack/react-query"
import type { PayrollSummary } from "@/lib/payroll"

export type { PayrollSummary } from "@/lib/payroll"
export type { PayrollDaySummary } from "@/lib/payroll"

export type PayrollCycle = "MONTHLY" | "BIWEEKLY" | "WEEKLY"

export type PayrollResponse = {
  period:      string
  paymentCycle: PayrollCycle
  half:         number
  items:        PayrollSummary[]
  generatedAt:  string
}

/**
 * Hook para obtener la pre-planilla de un período.
 *
 * @param period        "YYYY-MM" — si es null/undefined, la query no se ejecuta
 * @param paymentCycle  Ciclo de pago (default: "MONTHLY")
 * @param half          1 = primera quincena, 2 = segunda (solo para BIWEEKLY)
 * @param collaboratorId  ID opcional de un colaborador específico
 */
export function usePayrollSummary(
  period:         string | null | undefined,
  paymentCycle:   PayrollCycle = "MONTHLY",
  half:           1 | 2 = 1,
  collaboratorId?: number,
) {
  return useQuery({
    queryKey: ["payroll", period, paymentCycle, half, collaboratorId],
    enabled:  !!period,
    staleTime: 2 * 60_000, // 2 min — datos cambian al editar registros
    queryFn: async () => {
      const params = new URLSearchParams({
        period:       period!,
        paymentCycle,
        half:         String(half),
      })
      if (collaboratorId) params.set("collaboratorId", String(collaboratorId))

      const res = await fetch(`/api/payroll?${params}`)
      if (!res.ok) throw await res.json()
      return res.json() as Promise<PayrollResponse>
    },
  })
}

/**
 * Mutation para exportar la planilla como archivo .xlsx.
 * Dispara la descarga del archivo en el browser.
 */
export function useExportPayroll() {
  return useMutation({
    mutationFn: async (params: {
      period:       string
      paymentCycle: PayrollCycle
      half:         1 | 2
      collaboratorId?: number
    }) => {
      const qs = new URLSearchParams({
        period:       params.period,
        paymentCycle: params.paymentCycle,
        half:         String(params.half),
      })
      if (params.collaboratorId) qs.set("collaboratorId", String(params.collaboratorId))

      const res = await fetch(`/api/payroll/export?${qs}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al exportar" }))
        throw err
      }

      // Disparar descarga en el browser
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const filename =
        res.headers.get("Content-Disposition")?.split('filename="')[1]?.replace('"', '')
        ?? `planilla_${params.period}.xlsx`

      const anchor = document.createElement("a")
      anchor.href     = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    },
  })
}
