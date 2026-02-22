import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

// ─── Types ──────────────────────────────────────────────────────────────────

export type MarkType = "ENTRY" | "LUNCH_OUT" | "LUNCH_IN" | "EXIT" | "INCIDENCE"

export const MARK_LABELS: Record<MarkType, string> = {
  ENTRY:     "Entrada",
  LUNCH_OUT: "Salida a almuerzo",
  LUNCH_IN:  "Regreso de almuerzo",
  EXIT:      "Salida",
  INCIDENCE: "Incidencia",
}

export const MARK_BADGE: Record<MarkType, string> = {
  ENTRY:     "bg-emerald-100 text-emerald-800",
  LUNCH_OUT: "bg-sky-100 text-sky-800",
  LUNCH_IN:  "bg-indigo-100 text-indigo-800",
  EXIT:      "bg-amber-100 text-amber-800",
  INCIDENCE: "bg-red-100 text-red-800",
}

export type EditHistoryEntry = {
  id: number
  oldData: Record<string, unknown>
  newData: Record<string, unknown>
  reason: string
  editedAt: string
  editedBy: { id: number; name: string | null; email: string }
}

export type AccessRecord = {
  id: number
  collaboratorId: number
  collaborator: { id: number; dni: string; name: string }
  markType: MarkType
  status: "ON_TIME" | "LATE"
  timestamp: string
  minutesLate: number | null
  photo_url: string | null
  suspicious_reason: string | null
  confidence_flag: boolean
  editHistories: EditHistoryEntry[]
  justification: { reason: string } | null
}

// ─── Query params ─────────────────────────────────────────────────────────────

export type AccessQueryParams = {
  page?: number
  pageSize?: number
  search?: string
  date?: string
  dateFrom?: string
  dateTo?: string
  markType?: MarkType | ""
  status?: "ON_TIME" | "LATE" | ""
  collaboratorId?: number
  hasEdits?: boolean
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useAccessRecords(params: AccessQueryParams = {}) {
  const {
    page = 1, pageSize = 20, search = "",
    date, dateFrom, dateTo,
    markType, status, collaboratorId, hasEdits,
  } = params
  return useQuery({
    queryKey: ["access", page, pageSize, search, date ?? "", dateFrom ?? "", dateTo ?? "", markType ?? "", status ?? "", collaboratorId ?? 0, hasEdits ?? false],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search })
      if (date)                    qs.set("date",           date)
      if (dateFrom)                qs.set("dateFrom",       dateFrom)
      if (dateTo)                  qs.set("dateTo",         dateTo)
      if (markType)                qs.set("markType",       markType)
      if (status)                  qs.set("status",         status)
      if (collaboratorId)          qs.set("collaboratorId", String(collaboratorId))
      if (hasEdits !== undefined)  qs.set("hasEdits",       String(hasEdits))
      const r = await fetch(`/api/access?${qs}`)
      if (!r.ok) throw await r.json()
      return r.json() as Promise<{ items: AccessRecord[]; total: number }>
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

// ─── Manual insertion ────────────────────────────────────────────────────────

export type ManualMarkPayload = {
  collaboratorId: number
  markType: MarkType
  timestamp: string // ISO datetime
  reason: string
  status?: "ON_TIME" | "LATE"
}

export function useCreateManualMark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ManualMarkPayload) => {
      const r = await fetch("/api/access/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw await r.json()
      return r.json() as Promise<AccessRecord>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access"] }),
  })
}

// ─── Edit existing ───────────────────────────────────────────────────────────

export type PatchMarkPayload = {
  id: number
  markType?: MarkType
  timestamp?: string
  status?: "ON_TIME" | "LATE"
  reason: string
}

export function usePatchMark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: PatchMarkPayload) => {
      const r = await fetch(`/api/access/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw await r.json()
      return r.json() as Promise<AccessRecord>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access"] }),
  })
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export function useDeleteMark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const r = await fetch(`/api/access/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      if (!r.ok) throw await r.json()
      return r.json() as Promise<{ ok: boolean }>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access"] }),
  })
}
