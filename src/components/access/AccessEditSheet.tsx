'use client'
import { useState } from 'react'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton'
import {
  AccessRecord, MarkType, MARK_LABELS, MARK_BADGE,
  useCreateManualMark, usePatchMark, useDeleteMark,
} from '@/hooks/useAccessRecords'
import { useCollaborators } from '@/hooks/useCollaborators'
import { useDailySummary } from '@/hooks/useDailySummary'
import { DayTimeline } from '@/components/access/DayTimeline'

type Props = {
  open: boolean
  onClose: () => void
  /** Si se pasa una fila, el sheet abre en modo "editar día del colaborador" */
  record?: AccessRecord
  /** Todos los registros del mismo colaborador+día para mostrar el día completo */
  dayRecords?: AccessRecord[]
}

const MARK_OPTIONS: { value: MarkType; label: string }[] = [
  { value: 'ENTRY',     label: MARK_LABELS.ENTRY },
  { value: 'LUNCH_OUT', label: MARK_LABELS.LUNCH_OUT },
  { value: 'LUNCH_IN',  label: MARK_LABELS.LUNCH_IN },
  { value: 'EXIT',      label: MARK_LABELS.EXIT },
  { value: 'INCIDENCE', label: MARK_LABELS.INCIDENCE },
]

// ─── Sub-componente: formulario de edición de una fila ─────────────────────

function EditRow({ rec, onDone }: { rec: AccessRecord; onDone: () => void }) {
  const patch      = usePatchMark()
  const deleteMark = useDeleteMark()
  const [markType, setMarkType] = useState<MarkType>(rec.markType)
  const [timestamp, setTimestamp] = useState(dayjs(rec.timestamp).format('YYYY-MM-DDTHH:mm'))
  const [reason, setReason] = useState('')

  async function handleSave() {
    if (!reason.trim()) { toast.error('El motivo es obligatorio'); return }
    await patch.mutateAsync(
      { id: rec.id, markType, timestamp: new Date(timestamp).toISOString(), reason },
      { onSuccess: () => { toast.success('Marcación actualizada'); onDone() }, onError: () => toast.error('Error al actualizar') },
    )
  }

  return (
    <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${MARK_BADGE[rec.markType]}`}>
          {MARK_LABELS[rec.markType]}
        </span>
        <span className="text-xs text-muted-foreground">{dayjs(rec.timestamp).format('HH:mm')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Tipo</Label>
          <select
            value={markType}
            onChange={(e) => setMarkType(e.target.value as MarkType)}
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs"
          >
            {MARK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Hora</Label>
          <Input
            type="datetime-local"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Motivo <span className="text-destructive">*</span></Label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo de la corrección"
          className="h-8 text-xs"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={patch.isPending}>
          {patch.isPending ? 'Guardando…' : 'Guardar cambio'}
        </Button>
        <ConfirmDeleteButton
          itemName="esta marcación"
          disabled={deleteMark.isPending}
          onConfirm={async () => {
            if (!reason.trim()) { toast.error('Ingresa un motivo antes de eliminar'); return }
            await deleteMark.mutateAsync(
              { id: rec.id, reason },
              { onSuccess: () => { toast.success('Marcación eliminada'); onDone() }, onError: () => toast.error('Error al eliminar') },
            )
          }}
        />
      </div>
    </div>
  )
}

// ─── Formulario de inserción manual ──────────────────────────────────────────

function AddMarkForm({ collaboratorId, date, onDone }: { collaboratorId: number; date: string; onDone: () => void }) {
  const create = useCreateManualMark()
  const [markType, setMarkType] = useState<MarkType>('ENTRY')
  const [time, setTime] = useState('08:00')
  const [reason, setReason] = useState('')

  async function handleAdd() {
    if (!reason.trim()) { toast.error('El motivo es obligatorio'); return }
    const timestamp = new Date(`${date}T${time}:00`).toISOString()
    await create.mutateAsync(
      { collaboratorId, markType, timestamp, reason },
      { onSuccess: () => { toast.success('Marcación insertada'); onDone() }, onError: () => toast.error('Error al insertar') },
    )
  }

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">+ Insertar marcación manual</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Tipo</Label>
          <select
            value={markType}
            onChange={(e) => setMarkType(e.target.value as MarkType)}
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs"
          >
            {MARK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Hora</Label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Motivo <span className="text-destructive">*</span></Label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo de la inserción"
          className="h-8 text-xs"
        />
      </div>
      <Button size="sm" onClick={handleAdd} disabled={create.isPending}>
        {create.isPending ? 'Insertando…' : 'Insertar'}
      </Button>
    </div>
  )
}

// ─── Sheet principal ──────────────────────────────────────────────────────────

export function AccessEditSheet({ open, onClose, record, dayRecords = [] }: Props) {
  const { data: colData } = useCollaborators(1, 200, '')
  const collaborators = colData?.items ?? []

  // Modo nueva inserción independiente (sin record seleccionado)
  const [selColId, setSelColId] = useState<number | null>(record?.collaboratorId ?? null)
  const [selDate, setSelDate] = useState<string>(
    record ? dayjs(record.timestamp).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
  )

  const collaboratorName = record?.collaborator.name
    ?? collaborators.find((c) => c.id === selColId)?.name

  const summaryColId = record?.collaboratorId ?? null
  const summaryDate  = record ? dayjs(record.timestamp).format('YYYY-MM-DD') : null
  const { data: summary, isLoading: summaryLoading } = useDailySummary(summaryColId, summaryDate)

  // Convierte AccessRecord[] → el formato esperado por DayTimeline
  const timelineMarks = dayRecords.map((r) => ({
    id:        r.id,
    markType:  r.markType,
    timestamp: r.timestamp,
    status:    r.status,
  }))

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar marcaciones</SheetTitle>
          <SheetDescription>
            {collaboratorName
              ? `Día ${dayjs(record?.timestamp ?? selDate).format('DD/MM/YYYY')} — ${collaboratorName}`
              : 'Inserción manual de marcación'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Timeline del día con métricas */}
          {(dayRecords.length > 0 || summaryLoading) && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Resumen del día</p>
              <DayTimeline
                marks={timelineMarks}
                summary={summary}
                isLoading={summaryLoading}
              />
            </div>
          )}

          {/* Sección: formularios de edición por marcación */}
          {dayRecords.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Editar marcaciones</p>
              {dayRecords.map((r) => (
                <EditRow key={r.id} rec={r} onDone={onClose} />
              ))}
            </div>
          )}

          {/* El historial de ediciones (si hay) */}
          {record && record.editHistories.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Historial de cambios</p>
              {record.editHistories.map((h) => (
                <div key={h.id} className="rounded border p-2 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium">{h.editedBy.name ?? h.editedBy.email}</span>
                    <span className="text-muted-foreground">{dayjs(h.editedAt).format('DD/MM/YY HH:mm')}</span>
                  </div>
                  <p className="text-muted-foreground italic">{h.reason}</p>
                </div>
              ))}
            </div>
          )}

          {/* Selección de colaborador + fecha para inserción cuando no hay record */}
          {!record && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Colaborador</Label>
                <select
                  value={selColId ?? ''}
                  onChange={(e) => setSelColId(Number(e.target.value) || null)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                >
                  <option value="">— Seleccione —</option>
                  {collaborators.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.dni})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={selDate}
                  onChange={(e) => setSelDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}

          {/* Formulario de inserción */}
          {(record?.collaboratorId ?? selColId) && (
            <AddMarkForm
              collaboratorId={record?.collaboratorId ?? selColId!}
              date={record ? dayjs(record.timestamp).format('YYYY-MM-DD') : selDate}
              onDone={onClose}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
