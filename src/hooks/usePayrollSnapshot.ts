/**
 * Hooks para Cierre de Período (PayrollSnapshot + PayrollAdjustment).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ─── Types ─────────────────────────────────────────────────────────────────

export type SnapshotStatus = "DRAFT" | "CLOSED"

export interface SnapshotUser   { id: number; name: string | null }
export interface SnapshotAdjustment {
  id:             number
  snapshotId:     number
  collaboratorId: number
  collaborator:   { id: number; name: string }
  amount:         string   // Decimal as string from JSON
  description:    string
  createdById:    number
  createdBy:      SnapshotUser
  createdAt:      string
}

export interface SnapshotItem {
  collaboratorId:       number
  collaboratorName:     string
  period:               string
  paymentCycle:         string
  baseSalary:           number
  hourlyRate:           number
  scheduledDays:        number
  workedDays:           number
  totalMinutesLate:     number
  totalLateDiscount:    number
  totalOvertimeMinutes: number
  totalOvertimePay:     number
  totalNet:             number
}

export interface PayrollSnapshot {
  id:               number
  period:           string
  paymentCycle:     string
  half:             number | null
  status:           SnapshotStatus
  items:            SnapshotItem[]
  settingsSnapshot: unknown
  totalNet:         string
  closedAt:         string | null
  closedBy:         SnapshotUser | null
  createdById:      number
  createdBy:        SnapshotUser
  adjustments:      SnapshotAdjustment[]
  createdAt:        string
  updatedAt:        string
}

export interface SnapshotListItem extends Omit<PayrollSnapshot, "items" | "settingsSnapshot" | "adjustments"> {
  _count: { adjustments: number }
}

// ─── Helper ────────────────────────────────────────────────────────────────

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
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

// ─── Hooks ─────────────────────────────────────────────────────────────────

/** Lista snapshots, opcionalmente filtrados por período y/o estado. */
export function useSnapshots(period?: string, status?: SnapshotStatus) {
  const params = new URLSearchParams()
  if (period) params.set("period", period)
  if (status) params.set("status", status)
  return useQuery<SnapshotListItem[]>({
    queryKey: ["snapshots", period, status],
    queryFn:  () => api(`/api/payroll/snapshot?${params}`),
  })
}

/** Carga el detalle completo de un snapshot (con adjustments). */
export function useSnapshot(id: number | null) {
  return useQuery<PayrollSnapshot>({
    queryKey: ["snapshot", id],
    queryFn:  () => api(`/api/payroll/snapshot/${id!}`),
    enabled:  id !== null,
  })
}

/** Crea un nuevo snapshot DRAFT. */
export function useCreateSnapshot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { period: string; paymentCycle: string; half?: number }) =>
      api<PayrollSnapshot>("/api/payroll/snapshot", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snapshots"] }),
  })
}

/** Añade un ajuste manual (solo en DRAFT). */
export function useAddAdjustment(snapshotId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { collaboratorId: number; amount: number; description: string }) =>
      api<SnapshotAdjustment>(`/api/payroll/snapshot/${snapshotId}/adjustments`, {
        method: "POST",
        body:   JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snapshot", snapshotId] }),
  })
}

/** Elimina un ajuste (solo en DRAFT). */
export function useRemoveAdjustment(snapshotId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (adjId: number) =>
      api<void>(`/api/payroll/snapshot/${snapshotId}/adjustments/${adjId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snapshot", snapshotId] }),
  })
}

/** Cierra el período (DRAFT → CLOSED). */
export function useCloseSnapshot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api<PayrollSnapshot>(`/api/payroll/snapshot/${id}/close`, { method: "PATCH" }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["snapshots"] })
      qc.invalidateQueries({ queryKey: ["snapshot", id] })
    },
  })
}

/** Descarga el export del snapshot (xlsx o pdf). */
export function useExportSnapshot() {
  return useMutation({
    mutationFn: async ({ id, format, period }: { id: number; format: "xlsx" | "pdf"; period: string }) => {
      const ext = format === "xlsx" ? "xlsx" : "pdf"
      await downloadFile(
        `/api/payroll/snapshot/${id}/export?format=${format}`,
        `planilla-${period}.${ext}`,
      )
    },
  })
}
