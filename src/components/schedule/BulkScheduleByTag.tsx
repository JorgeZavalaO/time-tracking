'use client'
import { useState } from 'react'
import { useSchedules } from '@/hooks/useSchedules'
import { useBulkScheduleByTag } from '@/hooks/useBulkSchedule'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Users, Tag } from 'lucide-react'

export function BulkScheduleByTag() {
  const [tag, setTag] = useState('')
  const [scheduleId, setScheduleId] = useState<string>('')

  const { data: schedules = [], isLoading } = useSchedules('SPECIAL')
  const mutation = useBulkScheduleByTag()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tag.trim()) return

    mutation.mutate(
      {
        tag: tag.trim(),
        scheduleSpecialId: scheduleId ? Number(scheduleId) : null,
      },
      {
        onSuccess: ({ count }) => {
          toast.success(`Horario actualizado en ${count} colaborador(es)`)
          setTag('')
          setScheduleId('')
        },
        onError: (e) => {
          const msg =
            typeof e === 'object' && e !== null && 'error' in e
              ? (e as { error?: string }).error
              : undefined
          toast.error(msg ?? 'Error al aplicar asignación masiva')
        },
      },
    )
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Asignación masiva por etiqueta</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Asigna un horario especial a todos los colaboradores que tengan una etiqueta específica.
        Deja el horario vacío para quitar el horario especial (volverán al horario general).
      </p>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="bulk-tag" className="text-xs">
            <Tag className="inline size-3 mr-1" />
            Etiqueta
          </Label>
          <Input
            id="bulk-tag"
            placeholder="Ej. turno-mañana"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bulk-schedule" className="text-xs">Horario especial</Label>
          <select
            id="bulk-schedule"
            value={scheduleId}
            onChange={(e) => setScheduleId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            disabled={isLoading}
          >
            <option value="">— Quitar horario especial —</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.days} · {s.startTime}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button
            type="submit"
            disabled={mutation.isPending || !tag.trim()}
            className="w-full"
          >
            {mutation.isPending ? 'Aplicando…' : 'Aplicar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
