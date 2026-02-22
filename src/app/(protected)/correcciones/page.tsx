'use client'
import { useState } from 'react'
import dayjs from 'dayjs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SkeletonRow from '@/components/skeleton/SkeletonRow'
import { AccessEditSheet } from '@/components/access/AccessEditSheet'
import {
  AccessRecord, MarkType, MARK_LABELS, MARK_BADGE,
  useAccessRecords,
} from '@/hooks/useAccessRecords'

const PAGE_SIZE = 20

const MARK_OPTIONS: { value: '' | MarkType; label: string }[] = [
  { value: '',          label: 'Todos los tipos' },
  { value: 'ENTRY',     label: MARK_LABELS.ENTRY },
  { value: 'LUNCH_OUT', label: MARK_LABELS.LUNCH_OUT },
  { value: 'LUNCH_IN',  label: MARK_LABELS.LUNCH_IN },
  { value: 'EXIT',      label: MARK_LABELS.EXIT },
  { value: 'INCIDENCE', label: MARK_LABELS.INCIDENCE },
]

export default function CorreccionesPage() {
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [markType, setMarkType] = useState<'' | MarkType>('')
  const [status, setStatus]     = useState<'' | 'ON_TIME' | 'LATE'>('')
  const [showOnlyEdited, setShowOnlyEdited] = useState(false)

  const [sheetOpen, setSheetOpen]   = useState(false)
  const [editRecord, setEditRecord] = useState<AccessRecord | undefined>()
  const [dayRecords, setDayRecords] = useState<AccessRecord[]>([])

  const { data, isLoading } = useAccessRecords({
    page,
    pageSize: PAGE_SIZE,
    search:   search   || undefined,
    dateFrom: dateFrom || undefined,
    dateTo:   dateTo   || undefined,
    markType: markType || undefined,
    status:   status   || undefined,
    hasEdits: showOnlyEdited ? true : undefined,
  })

  const items     = data?.items ?? []
  const total     = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function openSheet(record: AccessRecord, all: AccessRecord[]) {
    const dateKey  = dayjs(record.timestamp).format('YYYY-MM-DD')
    const siblings = all.filter(
      (r) => r.collaboratorId === record.collaboratorId
          && dayjs(r.timestamp).format('YYYY-MM-DD') === dateKey,
    )
    setEditRecord(record)
    setDayRecords(siblings)
    setSheetOpen(true)
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Correcciones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Historial de ediciones manuales y marcaciones con incidencias
          </p>
        </div>
        <Button onClick={() => { setEditRecord(undefined); setDayRecords([]); setSheetOpen(true) }}>
          + Inserción manual
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar nombre o DNI…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-9 w-52"
            />
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="h-9 w-40"
              />
              <span className="text-muted-foreground text-xs">a</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="h-9 w-40"
              />
            </div>
            <select
              value={markType}
              onChange={(e) => { setMarkType(e.target.value as '' | MarkType); setPage(1) }}
              className="flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
            >
              {MARK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as '' | 'ON_TIME' | 'LATE'); setPage(1) }}
              className="flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
            >
              <option value="">Todos los estados</option>
              <option value="ON_TIME">A tiempo</option>
              <option value="LATE">Tarde</option>
            </select>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlyEdited}
                onChange={(e) => { setShowOnlyEdited(e.target.checked); setPage(1) }}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Solo con ediciones
            </label>
            <Button
              variant={markType === 'INCIDENCE' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setMarkType(markType === 'INCIDENCE' ? '' : 'INCIDENCE'); setPage(1) }}
            >
              Solo incidencias
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading ? 'Cargando…' : `${total} marcación${total !== 1 ? 'es' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left">Fecha / Hora</th>
                  <th className="p-3 text-left">Colaborador</th>
                  <th className="p-3 text-left">Tipo</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-left">Ediciones</th>
                  <th className="p-3 text-left">Último editor</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonRow key={i} cols={7} />
                ))}
                {!isLoading && items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No hay registros con los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {!isLoading && items.map((a) => {
                  const lastEdit = a.editHistories[a.editHistories.length - 1]
                  return (
                    <tr key={a.id} className="odd:bg-background/50 hover:bg-accent/5 border-b last:border-0">
                      <td className="p-3 whitespace-nowrap">
                        {dayjs(a.timestamp).format('DD/MM/YYYY HH:mm')}
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{a.collaborator.name}</div>
                        <div className="text-xs text-muted-foreground">{a.collaborator.dni}</div>
                      </td>
                      <td className="p-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${MARK_BADGE[a.markType]}`}>
                          {MARK_LABELS[a.markType]}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                          a.status === 'ON_TIME'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {a.status === 'ON_TIME' ? 'A tiempo' : 'Tarde'}
                        </span>
                      </td>
                      <td className="p-3">
                        {a.editHistories.length > 0 ? (
                          <span className="rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                            {a.editHistories.length} edición{a.editHistories.length !== 1 ? 'es' : ''}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {lastEdit ? (
                          <div>
                            <div>{lastEdit.editedBy?.name ?? lastEdit.editedBy?.email ?? '—'}</div>
                            <div className="text-muted-foreground/60">
                              {dayjs(lastEdit.editedAt).format('DD/MM HH:mm')}
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => openSheet(a, items)}>
                          Editar
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-xs text-muted-foreground">Página {page} de {pageCount}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ← Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                  Siguiente →
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AccessEditSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        record={editRecord}
        dayRecords={dayRecords}
      />
    </section>
  )
}
