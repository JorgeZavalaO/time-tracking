"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import {
  useSnapshot,
  useAddAdjustment,
  useRemoveAdjustment,
  useCloseSnapshot,
  useExportSnapshot,
  type SnapshotItem,
  type SnapshotAdjustment,
} from "@/hooks/usePayrollSnapshot"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

const STATUS_CLS: Record<string, string> = {
  DRAFT:  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  CLOSED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
}
const STATUS_LABELS: Record<string, string> = { DRAFT: "Borrador", CLOSED: "Cerrado" }

function fmtMoney(n: number | string) {
  return new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2 }).format(Number(n))
}

// ─── Fila de ajuste ───────────────────────────────────────────────────────
function AdjRow({ adj, canDelete, onDelete }: { adj: SnapshotAdjustment; canDelete: boolean; onDelete: () => void }) {
  return (
    <tr className="border-t hover:bg-muted/40 text-sm">
      <td className="px-4 py-2">{adj.collaborator.name}</td>
      <td className={`px-4 py-2 text-right font-semibold ${Number(adj.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
        {Number(adj.amount) >= 0 ? "+" : ""}{fmtMoney(adj.amount)}
      </td>
      <td className="px-4 py-2 text-muted-foreground">{adj.description}</td>
      <td className="px-4 py-2 text-muted-foreground">{adj.createdBy?.name ?? "—"}</td>
      <td className="px-4 py-2 text-right">
        {canDelete && (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
            Eliminar
          </Button>
        )}
      </td>
    </tr>
  )
}

// ─── Formulario nuevo ajuste ──────────────────────────────────────────────
function AddAdjustmentForm({
  items,
  onAdd,
  isPending,
}: {
  items: SnapshotItem[]
  onAdd: (data: { collaboratorId: number; amount: number; description: string }) => void
  isPending: boolean
}) {
  const [collaboratorId, setCollaboratorId] = useState("")
  const [amount,         setAmount]         = useState("")
  const [description,    setDescription]    = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!collaboratorId || !amount || !description.trim()) {
      toast.warning("Completa todos los campos del ajuste")
      return
    }
    onAdd({ collaboratorId: Number(collaboratorId), amount: Number(amount), description: description.trim() })
    setCollaboratorId("")
    setAmount("")
    setDescription("")
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="space-y-1 min-w-[160px]">
        <Label>Colaborador</Label>
        <select
          className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm"
          value={collaboratorId}
          onChange={(e) => setCollaboratorId(e.target.value)}
        >
          <option value="">Seleccionar…</option>
          {items.map((it) => (
            <option key={it.collaboratorId} value={it.collaboratorId}>{it.collaboratorName}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1 w-28">
        <Label>Monto (S/)</Label>
        <Input
          type="number"
          step="0.01"
          placeholder="+/-"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="space-y-1 flex-1 min-w-[200px]">
        <Label>Descripción</Label>
        <Input
          placeholder="Motivo del ajuste…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Guardando…" : "Añadir ajuste"}</Button>
    </form>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────
export default function CierreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = use(params)
  const id             = Number(idStr)
  const router         = useRouter()

  const { data: snap, isFetching, error } = useSnapshot(id)
  const addAdj    = useAddAdjustment(id)
  const removeAdj = useRemoveAdjustment(id)
  const closeMut  = useCloseSnapshot()
  const exportMut = useExportSnapshot()

  if (isFetching) return <p className="text-muted-foreground p-4">Cargando…</p>
  if (error)      return <p className="text-destructive p-4">{(error as Error).message}</p>
  if (!snap)      return null

  const isDraft = snap.status === "DRAFT"
  const items   = snap.items as SnapshotItem[]

  // Calcular ajustes por colaborador
  const adjMap = new Map<number, number>()
  for (const adj of snap.adjustments) {
    adjMap.set(adj.collaboratorId, (adjMap.get(adj.collaboratorId) ?? 0) + Number(adj.amount))
  }

  async function handleClose() {
    if (!confirm("¿Cerrar este período? Esta acción no se puede deshacer.")) return
    try {
      await closeMut.mutateAsync(id)
      toast.success("Período cerrado correctamente")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push("/cierre")}>
            ← Volver
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              Cierre {snap.period} — {snap.paymentCycle === "MONTHLY" ? "Mensual" : "Quincenal"}
              {snap.half ? ` (${snap.half}ª Q)` : ""}
            </h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLS[snap.status]}`}>
              {STATUS_LABELS[snap.status]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Creado por {snap.createdBy?.name ?? "—"} · {new Date(snap.createdAt).toLocaleDateString("es-PE")}
            {snap.closedBy && (
              <> · Cerrado por {snap.closedBy.name ?? "—"} el {new Date(snap.closedAt!).toLocaleDateString("es-PE")}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportMut.mutate({ id, format: "xlsx", period: snap.period })} disabled={exportMut.isPending}>
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportMut.mutate({ id, format: "pdf", period: snap.period })} disabled={exportMut.isPending}>
            PDF
          </Button>
          {isDraft && (
            <Button variant="destructive" size="sm" onClick={handleClose} disabled={closeMut.isPending}>
              {closeMut.isPending ? "Cerrando…" : "Cerrar período"}
            </Button>
          )}
        </div>
      </div>

      {/* Tabla resumen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen de planilla ({items.length} colaboradores)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Colaborador</th>
                  <th className="px-3 py-2 text-right">Días prog.</th>
                  <th className="px-3 py-2 text-right">Días trab.</th>
                  <th className="px-3 py-2 text-right">Sal. base (S/)</th>
                  <th className="px-3 py-2 text-right">Tardanzas (S/)</th>
                  <th className="px-3 py-2 text-right">H.E. (S/)</th>
                  <th className="px-3 py-2 text-right">Neto base (S/)</th>
                  <th className="px-3 py-2 text-right">Ajuste (S/)</th>
                  <th className="px-3 py-2 text-right font-semibold">Neto final (S/)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const adj = adjMap.get(it.collaboratorId) ?? 0
                  return (
                    <tr key={it.collaboratorId} className="border-t hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium">{it.collaboratorName}</td>
                      <td className="px-3 py-2 text-right">{it.scheduledDays}</td>
                      <td className="px-3 py-2 text-right">{it.workedDays}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(it.baseSalary)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(it.totalLateDiscount)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(it.totalOvertimePay)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(it.totalNet)}</td>
                      <td className={`px-3 py-2 text-right ${adj > 0 ? "text-green-600" : adj < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                        {adj !== 0 ? `${adj > 0 ? "+" : ""}${fmtMoney(adj)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtMoney(it.totalNet + adj)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td colSpan={8} className="px-3 py-2 font-semibold text-right">Total neto:</td>
                  <td className="px-3 py-2 text-right font-bold text-base">
                    S/ {fmtMoney(Number(snap.totalNet) + [...adjMap.values()].reduce((a, b) => a + b, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Panel ajustes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajustes manuales ({snap.adjustments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDraft && (
            <>
              <AddAdjustmentForm
                items={items}
                onAdd={(data) => addAdj.mutate(data, { onError: (e) => toast.error((e as Error).message) })}
                isPending={addAdj.isPending}
              />
              <Separator />
            </>
          )}

          {snap.adjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin ajustes registrados.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Colaborador</th>
                    <th className="px-4 py-2 text-right">Monto (S/)</th>
                    <th className="px-4 py-2 text-left">Descripción</th>
                    <th className="px-4 py-2 text-left">Por</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {snap.adjustments.map((adj) => (
                    <AdjRow
                      key={adj.id}
                      adj={adj}
                      canDelete={isDraft}
                      onDelete={() =>
                        removeAdj.mutate(adj.id, { onError: (e) => toast.error((e as Error).message) })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
