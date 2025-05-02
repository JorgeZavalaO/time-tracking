'use client'
import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useSchedules } from '@/hooks/useSchedules'
import { Schedule } from '@/hooks/useCollaborators'
import { useSaveCollaborator } from '@/hooks/useCollaboratorMutations'

type Props = {
  onClose: () => void
  page: number
  pageSize: number
  search: string
  initialData?: {
    id: number
    dni: string
    name: string
    active: boolean
    schedule: Schedule | null
  }
}

export function CollaboratorForm({
  onClose,
  page,
  pageSize,
  search,
  initialData,
}: Props) {
  const { data: schedules = [] } = useSchedules('SPECIAL')
  const saveMutation = useSaveCollaborator(page, pageSize, search)

  const [open, setOpen] = useState(false)
  const [dni, setDni] = useState('')
  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const [scheduleId, setScheduleId] = useState(0)

  /* ------------ precarga ------------ */
  useEffect(() => {
    if (open) {
      setDni(initialData?.dni ?? '')
      setName(initialData?.name ?? '')
      setActive(initialData?.active ?? true)
      setScheduleId(initialData?.schedule?.id ?? 0)
    }
  }, [open, initialData])

  /* ------------ submit ------------ */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (dni.length !== 8) return toast.error('DNI debe tener 8 dígitos')
    if (name.trim().length < 2)
      return toast.error('Nombre demasiado corto')

    saveMutation.mutate(
      {
        id: initialData?.id,
        dni,
        name: name.trim(),
        active,
        scheduleSpecialId: scheduleId || null,
      },
      {
        onSuccess: () => {
          toast.success('Guardado')
          setOpen(false)
          onClose()
        },
        onError: (err: Error) =>
          toast.error(err?.message ?? 'Error inesperado'),
      },
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={initialData ? 'outline' : 'default'}>
          {initialData ? 'Editar' : 'Nuevo colaborador'}
        </Button>
      </SheetTrigger>

      <SheetContent
        key={initialData?.id ?? 'new'}
        side="right"
        className="w-[400px]"
      >
        <SheetHeader>
          <SheetTitle>
            {initialData ? 'Editar colaborador' : 'Nuevo colaborador'}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <Label htmlFor="dni">DNI</Label>
            <Input
              id="dni"
              inputMode="numeric"
              pattern="\d{8}"
              value={dni}
              maxLength={8}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>

          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="schedule">Horario especial</Label>
            <select
              id="schedule"
              className="border rounded-md px-2 py-1 w-full"
              value={scheduleId}
              onChange={(e) => setScheduleId(Number(e.target.value))}
            >
              <option value={0}>— Usa horario general —</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.days} · {s.startTime}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <Label htmlFor="active">Activo</Label>
          </div>

          <SheetFooter className="flex justify-end gap-2">
            <SheetClose asChild>
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </SheetClose>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
