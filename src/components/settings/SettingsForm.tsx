'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useSettings, useUpdateSettings, CompanySettings } from '@/hooks/useSettings'

const schema = z.object({
  companyName:           z.string().min(1, 'Nombre requerido').max(255),
  ruc:                   z.string().max(20).optional().or(z.literal('')),
  timezone:              z.string().min(1),
  lateTolerance:         z.coerce.number().int().min(0).max(120),
  lateDiscountPolicy:    z.enum(['BY_MINUTE', 'BY_RANGE']),
  overtimeEnabled:       z.boolean(),
  overtimeBeforeMinutes: z.coerce.number().int().min(0).max(120),
  overtimeAfterMinutes:  z.coerce.number().int().min(0).max(480),
  overtimeRoundMinutes:  z.coerce.number().int().min(1).max(60),
  lunchDurationMinutes:  z.coerce.number().int().min(0).max(180),
  lunchDeductionType:    z.enum(['FIXED', 'REAL_TIME']),
})

type FormData = z.infer<typeof schema>

function toForm(s: CompanySettings): FormData {
  return {
    companyName:           s.companyName,
    ruc:                   s.ruc ?? '',
    timezone:              s.timezone,
    lateTolerance:         s.lateTolerance,
    lateDiscountPolicy:    s.lateDiscountPolicy,
    overtimeEnabled:       s.overtimeEnabled,
    overtimeBeforeMinutes: s.overtimeBeforeMinutes,
    overtimeAfterMinutes:  s.overtimeAfterMinutes,
    overtimeRoundMinutes:  s.overtimeRoundMinutes,
    lunchDurationMinutes:  s.lunchDurationMinutes,
    lunchDeductionType:    s.lunchDeductionType,
  }
}

export function SettingsForm() {
  const { data: settings, isLoading } = useSettings()
  const updateMutation = useUpdateSettings()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: '',
      ruc: '',
      timezone: 'America/Lima',
      lateTolerance: 0,
      lateDiscountPolicy: 'BY_MINUTE',
      overtimeEnabled: false,
      overtimeBeforeMinutes: 0,
      overtimeAfterMinutes: 0,
      overtimeRoundMinutes: 15,
      lunchDurationMinutes: 60,
      lunchDeductionType: 'FIXED',
    },
  })

  useEffect(() => {
    if (settings) reset(toForm(settings))
  }, [settings, reset])

  const overtimeEnabled = watch('overtimeEnabled')

  const onSubmit = handleSubmit(async (data) => {
    try {
      await updateMutation.mutateAsync({
        ...data,
        ruc: data.ruc || null,
      })
      toast.success('Configuración guardada')
      reset(data) // resetea dirty
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    }
  })

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Cargando configuración…</p>
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8 max-w-2xl">

      {/* ── Empresa ── */}
      <section className="space-y-4">
        <h2 className="font-semibold text-base border-b pb-1">Datos de empresa</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="companyName">Razón social</Label>
            <Input id="companyName" {...register('companyName')} />
            {errors.companyName && (
              <p className="text-destructive text-xs mt-1">{errors.companyName.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="ruc">RUC (opcional)</Label>
            <Input id="ruc" {...register('ruc')} placeholder="20XXXXXXXXX" />
          </div>
        </div>

        <div className="w-48">
          <Label htmlFor="timezone">Zona horaria</Label>
          <Input id="timezone" {...register('timezone')} placeholder="America/Lima" />
          {errors.timezone && (
            <p className="text-destructive text-xs mt-1">{errors.timezone.message}</p>
          )}
        </div>
      </section>

      {/* ── Tardanza ── */}
      <section className="space-y-4">
        <h2 className="font-semibold text-base border-b pb-1">Política de tardanza</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="lateTolerance">Tolerancia (minutos)</Label>
            <Input
              id="lateTolerance"
              type="number"
              min={0}
              max={120}
              {...register('lateTolerance')}
            />
            <p className="text-muted-foreground text-xs mt-1">
              Minutos de gracia antes de marcar como tarde.
            </p>
            {errors.lateTolerance && (
              <p className="text-destructive text-xs mt-1">{errors.lateTolerance.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="lateDiscountPolicy">Política de descuento</Label>
            <select
              id="lateDiscountPolicy"
              className="border rounded-md px-2 py-2 w-full text-sm"
              {...register('lateDiscountPolicy')}
            >
              <option value="BY_MINUTE">Por minuto</option>
              <option value="BY_RANGE">Por rangos</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Horas extra ── */}
      <section className="space-y-4">
        <h2 className="font-semibold text-base border-b pb-1">Horas extra</h2>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="overtimeEnabled" {...register('overtimeEnabled')} />
          <Label htmlFor="overtimeEnabled">Habilitar cálculo de horas extra</Label>
        </div>

        {overtimeEnabled && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="overtimeBeforeMinutes">Minutos antes del turno</Label>
              <Input id="overtimeBeforeMinutes" type="number" min={0} max={120} {...register('overtimeBeforeMinutes')} />
            </div>
            <div>
              <Label htmlFor="overtimeAfterMinutes">Minutos después del turno</Label>
              <Input id="overtimeAfterMinutes" type="number" min={0} max={480} {...register('overtimeAfterMinutes')} />
            </div>
            <div>
              <Label htmlFor="overtimeRoundMinutes">Redondeo (minutos)</Label>
              <Input id="overtimeRoundMinutes" type="number" min={1} max={60} {...register('overtimeRoundMinutes')} />
            </div>
          </div>
        )}
      </section>

      {/* ── Almuerzo ── */}
      <section className="space-y-4">
        <h2 className="font-semibold text-base border-b pb-1">Regla de almuerzo</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="lunchDurationMinutes">Duración esperada (minutos)</Label>
            <Input id="lunchDurationMinutes" type="number" min={0} max={180} {...register('lunchDurationMinutes')} />
          </div>
          <div>
            <Label htmlFor="lunchDeductionType">Tipo de descuento</Label>
            <select
              id="lunchDeductionType"
              className="border rounded-md px-2 py-2 w-full text-sm"
              {...register('lunchDeductionType')}
            >
              <option value="FIXED">Fijo (siempre descuenta la duración)</option>
              <option value="REAL_TIME">Tiempo real (descuenta lo que dure)</option>
            </select>
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar configuración'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!isDirty}
          onClick={() => settings && reset(toForm(settings))}
        >
          Descartar cambios
        </Button>
      </div>
    </form>
  )
}
