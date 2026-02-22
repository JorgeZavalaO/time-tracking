"use client"

import { useState } from "react"
import { useAttendanceReport, useExportReport } from "@/hooks/useReports"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

function pct(n: number) {
  return `${n.toFixed(1)}%`
}
function fmt(mins: number) {
  const h = Math.floor(Math.abs(mins) / 60)
  const m = Math.abs(mins) % 60
  return `${h}h ${m}m`
}

export default function AsistenciaPage() {
  const today    = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(monthAgo)
  const [dateTo,   setDateTo]   = useState(today)
  const [search,   setSearch]   = useState(false)

  const { data, isFetching, error } = useAttendanceReport(dateFrom, dateTo, undefined, search)
  const exportMutation = useExportReport()

  function handleSearch() { setSearch(true) }
  function handleExport(format: "xlsx" | "pdf") {
    exportMutation.mutate(
      { type: "attendance", params: { dateFrom, dateTo }, format },
      { onError: (e) => toast.error((e as Error).message) },
    )
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setSearch(false) }} />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setSearch(false) }} />
            </div>
            <Button onClick={handleSearch} disabled={isFetching}>
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
                <th className="px-4 py-2 text-right">Prog.</th>
                <th className="px-4 py-2 text-right">Presente</th>
                <th className="px-4 py-2 text-right">Ausente</th>
                <th className="px-4 py-2 text-right">Horas netas</th>
                <th className="px-4 py-2 text-right">Asistencia</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.collaboratorId} className="border-t hover:bg-muted/40">
                  <td className="px-4 py-2 font-medium">{it.collaboratorName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{it.position}</td>
                  <td className="px-4 py-2 text-right">{it.scheduledDays}</td>
                  <td className="px-4 py-2 text-right">{it.presentDays}</td>
                  <td className="px-4 py-2 text-right">{it.absentDays}</td>
                  <td className="px-4 py-2 text-right">{fmt(it.totalNetMinutes)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{pct(it.attendancePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
