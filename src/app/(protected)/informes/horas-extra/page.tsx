"use client"

import { useState } from "react"
import { useOvertimeReport, useExportReport } from "@/hooks/useReports"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2 }).format(n)
}
function fmtHours(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

const CYCLES = [{ value: "BIWEEKLY", label: "Quincenal" }, { value: "MONTHLY", label: "Mensual" }]

export default function HorasExtraPage() {
  const now = new Date()
  const [period,       setPeriod]       = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  const [paymentCycle, setPaymentCycle] = useState("MONTHLY")
  const [half,         setHalf]         = useState<number | undefined>(undefined)
  const [search,       setSearch]       = useState(false)

  const { data, isFetching, error } = useOvertimeReport(period, paymentCycle, half, search)
  const exportMutation = useExportReport()

  function handleExport(format: "xlsx" | "pdf") {
    exportMutation.mutate(
      { type: "overtime", params: { period, paymentCycle, half }, format },
      { onError: (e) => toast.error((e as Error).message) },
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>Período</Label>
              <Input
                type="month"
                value={period}
                onChange={(e) => { setPeriod(e.target.value); setSearch(false) }}
              />
            </div>
            <div className="space-y-1">
              <Label>Ciclo</Label>
              <select
                className="flex h-9 rounded-md border bg-background px-3 py-1 text-sm shadow-sm"
                value={paymentCycle}
                onChange={(e) => { setPaymentCycle(e.target.value); setHalf(undefined); setSearch(false) }}
              >
                {CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {paymentCycle === "BIWEEKLY" && (
              <div className="space-y-1">
                <Label>Quincena</Label>
                <select
                  className="flex h-9 rounded-md border bg-background px-3 py-1 text-sm shadow-sm"
                  value={half ?? ""}
                  onChange={(e) => { setHalf(Number(e.target.value)); setSearch(false) }}
                >
                  <option value="">Todas</option>
                  <option value="1">1ª quincena</option>
                  <option value="2">2ª quincena</option>
                </select>
              </div>
            )}
            <Button onClick={() => setSearch(true)} disabled={isFetching}>
              {isFetching ? "Cargando…" : "Generar"}
            </Button>
            {data && (
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")} disabled={exportMutation.isPending}>Excel</Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}  disabled={exportMutation.isPending}>PDF</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {data && (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Colaborador</th>
                <th className="px-4 py-2 text-left">Cargo</th>
                <th className="px-4 py-2 text-right">Días c/H.E.</th>
                <th className="px-4 py-2 text-right">Total H.E.</th>
                <th className="px-4 py-2 text-right">Tarifa/hr</th>
                <th className="px-4 py-2 text-right">Monto H.E.</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.collaboratorId} className="border-t hover:bg-muted/40">
                  <td className="px-4 py-2 font-medium">{it.collaboratorName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{it.position}</td>
                  <td className="px-4 py-2 text-right">{it.daysWithOvertime}</td>
                  <td className="px-4 py-2 text-right">{fmtHours(it.totalOvertimeMinutes)}</td>
                  <td className="px-4 py-2 text-right">{fmtMoney(it.hourlyRate)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{fmtMoney(it.totalOvertimePay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
