"use client"

import { useState } from "react"
import { useIncidencesReport, useExportReport } from "@/hooks/useReports"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

export default function IncidenciasPage() {
  const today    = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(monthAgo)
  const [dateTo,   setDateTo]   = useState(today)
  const [search,   setSearch]   = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const { data, isFetching, error } = useIncidencesReport(dateFrom, dateTo, search)
  const exportMutation = useExportReport()

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleExport(format: "xlsx" | "pdf") {
    exportMutation.mutate(
      { type: "incidences", params: { dateFrom, dateTo }, format },
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
              <Label>Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setSearch(false) }} />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setSearch(false) }} />
            </div>
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
        <div className="space-y-2">
          {data.items.map((it) => (
            <div key={it.collaboratorId} className="rounded-md border">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                onClick={() => toggle(it.collaboratorId)}
              >
                <div>
                  <span className="font-medium">{it.collaboratorName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{it.position}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">{it.daysWithIncidences} días</span>
                  <span className="font-semibold text-destructive">{it.totalIncidences} incidencias</span>
                  <span className="text-muted-foreground">{expanded.has(it.collaboratorId) ? "▲" : "▼"}</span>
                </div>
              </button>

              {expanded.has(it.collaboratorId) && (
                <div className="border-t px-4 py-3 space-y-2 bg-muted/20">
                  {it.detail.map(({ date, incidences }) => (
                    <div key={date} className="text-sm">
                      <span className="font-medium">{date}</span>
                      <ul className="list-disc list-inside ml-2 text-muted-foreground">
                        {incidences.map((inc, i) => (
                          <li key={i}>{inc}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
