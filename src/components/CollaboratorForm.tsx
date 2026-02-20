'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useSchedules } from '@/hooks/useSchedules'
import { Schedule } from '@/hooks/useCollaborators'
import { useSaveCollaborator } from '@/hooks/useCollaboratorMutations'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import QRCode from 'qrcode'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Props del componente
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
    isBlocked?: boolean
    hasPin?: boolean
    hasQr?: boolean
    schedule: Schedule | null
  }
}

// Esquema Zod (sin transform)
const schema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'DNI debe tener 8 dígitos'),
  name: z.string().min(2, 'Nombre muy corto'),
  active: z.boolean(),
  isBlocked: z.boolean(),
  pin: z.string().regex(/^$|^\d{4,8}$/, 'PIN debe tener 4 a 8 dígitos'),
  // Recibimos string (option value), lo validamos como cualquier string
  scheduleSpecialId: z.string(),
})

// Tipo del formulario (lo que recibe React Hook Form)
type FormData = z.infer<typeof schema>

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
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      dni: '',
      name: '',
      active: true,
      isBlocked: false,
      pin: '',
      scheduleSpecialId: '',
    },
  })

  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrImage, setQrImage] = useState<string>('')
  const [qrPayload, setQrPayload] = useState<string>('')
  const [isGeneratingQr, setIsGeneratingQr] = useState(false)

  // Cuando abrimos el Sheet, precargamos los valores
  useEffect(() => {
    if (open) {
      reset({
        dni: initialData?.dni ?? '',
        name: initialData?.name ?? '',
        active: initialData?.active ?? true,
        isBlocked: initialData?.isBlocked ?? false,
        pin: '',
        scheduleSpecialId: initialData?.schedule?.id
          ? String(initialData.schedule.id)
          : '',
      })
    }
  }, [open, initialData, reset])

  // Controlamos la apertura/cierre para avisar si hay cambios sin guardar
  const handleOpenChange = (next: boolean) => {
    if (!next && isDirty) {
      setConfirmCloseOpen(true)
    } else {
      setOpen(next)
      if (!next) onClose()
    }
  }

  // Al enviar, convertimos scheduleSpecialId a number|null
  const onSubmit = handleSubmit((data) => {
    const payload = {
      id: initialData?.id,
      dni: data.dni,
      name: data.name.trim(),
      active: data.active,
      isBlocked: data.isBlocked,
      pin: data.pin || undefined,
      scheduleSpecialId:
        data.scheduleSpecialId === '' ? null : Number(data.scheduleSpecialId),
    }

    saveMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Guardado')
        setOpen(false)
        onClose()
      },
      onError: (err: Error) =>
        toast.error(err?.message ?? 'Error inesperado'),
    })
  })

  const handleGenerateQr = async () => {
    if (!initialData?.id) {
      toast.error('Guarda el colaborador primero para generar QR')
      return
    }

    try {
      setIsGeneratingQr(true)
      const r = await fetch(`/api/collaborators/${initialData.id}/qr`, {
        method: 'POST',
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err?.error ?? 'No se pudo generar el QR')
      }

      const data = await r.json()
      const payload = data.qrPayload as string
      const dataUrl = await QRCode.toDataURL(payload, { width: 280, margin: 1 })

      setQrPayload(payload)
      setQrImage(dataUrl)
      setQrDialogOpen(true)
      toast.success('QR regenerado correctamente')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error generando QR')
    } finally {
      setIsGeneratingQr(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
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

          <form onSubmit={onSubmit} className="space-y-4 p-4">
            {/* DNI */}
            <div>
              <Label htmlFor="dni">DNI</Label>
              <Input
                id="dni"
                inputMode="numeric"
                maxLength={8}
                {...register('dni')}
                onChange={(e) =>
                  setValue('dni', e.target.value.replace(/\D/g, ''))
                }
              />
              {errors.dni && (
                <p className="text-destructive text-sm">{errors.dni.message}</p>
              )}
            </div>

            {/* Nombre */}
            <div>
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" {...register('name')} />
              {errors.name && (
                <p className="text-destructive text-sm">{errors.name.message}</p>
              )}
            </div>

            {/* Horario especial */}
            <div>
              <Label htmlFor="schedule">Horario especial</Label>
              <select
                id="schedule"
                className="border rounded-md px-2 py-1 w-full"
                {...register('scheduleSpecialId')}
              >
                <option value="">— Usa horario general —</option>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.days} · {s.startTime}
                  </option>
                ))}
              </select>
            </div>

            {/* Activo */}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" {...register('active')} />
              <Label htmlFor="active">Activo</Label>
            </div>

            {/* Bloqueado */}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isBlocked" {...register('isBlocked')} />
              <Label htmlFor="isBlocked">Bloqueado</Label>
            </div>

            {/* PIN */}
            <div>
              <Label htmlFor="pin">PIN (4-8 dígitos)</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder={initialData?.hasPin ? '•••• (dejar vacío para mantener)' : 'Ej: 1234'}
                {...register('pin')}
                onChange={(e) => setValue('pin', e.target.value.replace(/\D/g, ''))}
              />
              {errors.pin && (
                <p className="text-destructive text-sm">{errors.pin.message}</p>
              )}
            </div>

            {initialData?.id && (
              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleGenerateQr}
                  disabled={isGeneratingQr}
                >
                  {isGeneratingQr ? 'Generando QR…' : 'Generar / Regenerar QR'}
                </Button>
              </div>
            )}

            <SheetFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR de colaborador</DialogTitle>
            <DialogDescription>
              Usa este código para marcación por QR + PIN. No contiene DNI en claro.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3">
            {qrImage ? (
              <Image
                src={qrImage}
                alt="Código QR del colaborador"
                width={256}
                height={256}
                className="h-64 w-64"
                unoptimized
              />
            ) : null}
            <p className="text-xs text-muted-foreground break-all">{qrPayload}</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
            >
              Imprimir carnet
            </Button>
            <Button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(qrPayload)
                toast.success('Payload QR copiado')
              }}
            >
              Copiar código
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación de cierre sin guardar */}
      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmCloseOpen(false)
                setOpen(false)
                onClose()
              }}
            >
              Salir sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
