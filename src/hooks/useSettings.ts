import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export type CompanySettings = {
  id: number
  companyName: string
  ruc: string | null
  timezone: string
  lateTolerance: number
  lateDiscountPolicy: "BY_MINUTE" | "BY_RANGE"
  overtimeEnabled: boolean
  overtimeBeforeMinutes: number
  overtimeAfterMinutes: number
  overtimeRoundMinutes: number
  lunchDurationMinutes: number
  lunchDeductionType: "FIXED" | "REAL_TIME"
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings")
      if (!r.ok) throw await r.json()
      return r.json() as Promise<CompanySettings>
    },
    staleTime: 5 * 60_000, // 5 min — cambia poco
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Omit<CompanySettings, "id">>) => {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw await r.json()
      return r.json() as Promise<CompanySettings>
    },
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data)
    },
  })
}
