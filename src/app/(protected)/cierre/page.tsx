"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSnapshots, useCreateSnapshot, type SnapshotStatus } from "@/hooks/usePayrollSnapshot"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
const STATUS_LABELS: Record<SnapshotStatus, string> = {
  DRAFT:  "Borrador",
  CLOSED: "Cerrado",
}
const STATUS_CLS: Record<SnapshotStatus, string> = {
  DRAFT:  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  CLOSED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
}

const CYCLES = [
  { value: "MONTHLY",   label: "Mensual"   },
  { value: "BIWEEKLY",  label: "Quincenal" },
]

export default function CierrePage() {
  const router   = useRouter()
  const [open,         setOpen]         = useState(false)
  const [period,       setPeriod]       = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [paymentCycle, setPaymentCycle] = useState("MONTHLY")
  const [half,         setHalf]         = useState<number | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<SnapshotStatus | "">("")

  const { data: snapshots = [], isFetching, refetch } = useSnapshots(
    undefined,
    statusFilter || undefined,
  )
  const createMut = useCreateSnapshot()

  async function handleCreate() {
    try {
      const snap = await createMut.mutateAsync({ period, paymentCycle, half })
      toast.success("Cierre creado como Borrador")
      setOpen(false)
      router.push(`/cierre/${snap.id}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cierre de período</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea y gestiona los cierres de planilla por período.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Nuevo cierre</Button>
      </div>

      {/* Filtro de estado */}
      <div className="flex items-center gap-3">
        <Label>Estado:</Label>
        <select
          className="flex h-8 rounded-md border bg-background px-2 py-1 text-sm shadow-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SnapshotStatus | "")}
        >
          <option value="">Todos</option>
          <option value="DRAFT">Borrador</option>
          <option value="CLOSED">Cerrado</option>
        </select>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>↺</Button>
      </div>

      {/* Tabla de cierres */}
      <div className="rounded-md border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Período</th>
              <th className="px-4 py-2 text-left">Ciclo</th>
              <th className="px-4 py-2 text-left">Quincena</th>
              <th className="px-4 py-2 text-right">Total neto (S/)</th>
              <th className="px-4 py-2 text-center">Ajustes</th>
              <th className="px-4 py-2 text-center">Estado</th>
              <th className="px-4 py-2 text-left">Creado por</th>
              <th className="px-4 py-2 text-left">Fecha</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {isFetching && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td>
              </tr>
            )}
            {!isFetching && snapshots.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Sin cierres aún</td>
              </tr>
            )}
            {snapshots.map((snap) => (
              <tr key={snap.id} className="border-t hover:bg-muted/40">
                <td className="px-4 py-2 font-medium">{snap.period}</td>
                <td className="px-4 py-2">{snap.paymentCycle === "MONTHLY" ? "Mensual" : "Quincenal"}</td>
                <td className="px-4 py-2">{snap.half ? `${snap.half}ª Q` : "—"}</td>
                <td className="px-4 py-2 text-right font-semibold">
                  {new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2 }).format(Number(snap.totalNet))}
                </td>
                <td className="px-4 py-2 text-center">{snap._count.adjustments}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[snap.status]}`}>
                    {STATUS_LABELS[snap.status]}
                  </span>
                </td>
                <td className="px-4 py-2">{snap.createdBy?.name ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(snap.createdAt).toLocaleDateString("es-PE")}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/cierre/${snap.id}`)}>
                    Ver →
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog nuevo cierre */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo cierre de período</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Período</Label>
              <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Ciclo de pago</Label>
              <select
                className="flex w-full h-9 rounded-md border bg-background px-3 py-1 text-sm shadow-sm"
                value={paymentCycle}
                onChange={(e) => { setPaymentCycle(e.target.value); setHalf(undefined) }}
              >
                {CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {paymentCycle === "BIWEEKLY" && (
              <div className="space-y-1">
                <Label>Quincena</Label>
                <select
                  className="flex w-full h-9 rounded-md border bg-background px-3 py-1 text-sm shadow-sm"
                  value={half ?? ""}
                  onChange={(e) => setHalf(Number(e.target.value))}
                >
                  <option value="">Seleccionar…</option>
                  <option value="1">1ª quincena (1–15)</option>
                  <option value="2">2ª quincena (16–fin)</option>
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? "Generando…" : "Crear borrador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
