'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useSettings, useUpdateSettings, CompanySettings } from '@/hooks/useSettings'

const schema = z.object({
  companyName:           z.string().min(1, 'Nombre requerido').max(255),
  ruc:                   z.string().max(20).optional().or(z.literal('')),
  timezone:              z.string().min(1),
  lateTolerance:         z.coerce.number().int().min(0).max(120),
  lateDiscountPolicy:    z.enum(['BY_MINUTE', 'BY_RANGE']),
  overtimeEnabled:       z.boolean(),
  overtimeBeforeMinutes: z.coerce.number().int().min(0).max(120),
  /** % extra sobre la tarifa. 0 = sin recargo (×1.0), 50 = ×1.5, 100 = ×2.0 */
  overtimeFactorPct:     z.coerce.number().min(0).max(900),
  workdayHours:          z.coerce.number().int().min(1).max(24),
  lunchDurationMinutes:  z.coerce.number().int().min(0).max(180),
  lunchDeductionType:    z.enum(['FIXED', 'REAL_TIME']),
  lunchRequired:         z.boolean(),
  entryWindowStart:      z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
  entryWindowEnd:        z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
  lunchWindowStart:      z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
  lunchWindowEnd:        z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
  exitWindowStart:       z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
  exitWindowEnd:         z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
  maxMarksPerDay:        z.coerce.number().int().min(2).max(10),
  lunchSkipHours:        z.coerce.number().int().min(1).max(12),
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
    // Convertir decimal → % de recargo (1.5 → 50, 1.0 → 0, 2.0 → 100)
    overtimeFactorPct:     parseFloat(((Number(s.overtimeFactor) - 1) * 100).toFixed(2)),
    workdayHours:          s.workdayHours,
    lunchDurationMinutes:  s.lunchDurationMinutes,
    lunchDeductionType:    s.lunchDeductionType,
    lunchRequired:         s.lunchRequired,
    entryWindowStart:      s.entryWindowStart,
    entryWindowEnd:        s.entryWindowEnd,
    lunchWindowStart:      s.lunchWindowStart,
    lunchWindowEnd:        s.lunchWindowEnd,
    exitWindowStart:       s.exitWindowStart,
    exitWindowEnd:         s.exitWindowEnd,
    maxMarksPerDay:        s.maxMarksPerDay,
    lunchSkipHours:        s.lunchSkipHours,
  }
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground mt-1">{children}</p>
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-destructive mt-1">{msg}</p>
}

export function SettingsForm() {
  const { data: settings, isLoading } = useSettings()
  const updateMutation = useUpdateSettings()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
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
      overtimeFactorPct: 50,   // 50 % extra = factor 1.5
      workdayHours: 8,
      lunchDurationMinutes: 60,
      lunchDeductionType: 'FIXED',
      lunchRequired: false,
      entryWindowStart: '05:00',
      entryWindowEnd:   '11:00',
      lunchWindowStart: '11:00',
      lunchWindowEnd:   '15:30',
      exitWindowStart:  '15:00',
      exitWindowEnd:    '23:00',
      maxMarksPerDay:   4,
      lunchSkipHours:   4,
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
        // Convertir % extra → factor decimal (50 → 1.5, 0 → 1.0, 100 → 2.0)
        overtimeFactor:       parseFloat((1 + data.overtimeFactorPct / 100).toFixed(4)),
        // Valores fijos: sin redondeo efectivo, sin umbral post-turno
        overtimeRoundMinutes: 1,
        overtimeAfterMinutes: 0,
      } as Parameters<typeof updateMutation.mutateAsync>[0])
      toast.success('Configuración guardada')
      reset(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    }
  })

  if (isLoading) {
    return <p className="text-muted-foreground text-sm py-4">Cargando configuración…</p>
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">

      {/* ── Empresa ── */}
      <Card className="shadow-none border">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="companyName" className="text-xs">Razón social</Label>
              <Input id="companyName" className="mt-1" {...register('companyName')} />
              <FieldError msg={errors.companyName?.message} />
            </div>
            <div>
              <Label htmlFor="ruc" className="text-xs">RUC <span className="text-muted-foreground">(opcional)</span></Label>
              <Input id="ruc" className="mt-1" {...register('ruc')} placeholder="20XXXXXXXXX" />
            </div>
          </div>
          <div className="w-64">
            <Label htmlFor="timezone" className="text-xs">Zona horaria</Label>
            <Input id="timezone" className="mt-1 font-mono text-sm" {...register('timezone')} />
            <FieldHint>UTC−5 · Lima, Perú. Modifica solo si el servidor opera en otra zona horaria.</FieldHint>
            <FieldError msg={errors.timezone?.message} />
          </div>
        </CardContent>
      </Card>

      {/* ── Tardanza ── */}
      <Card className="shadow-none border">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Tardanza
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="lateTolerance" className="text-xs">Tolerancia (minutos)</Label>
            <Input
              id="lateTolerance"
              type="number"
              min={0}
              max={120}
              className="mt-1"
              {...register('lateTolerance')}
            />
            <FieldHint>Minutos de gracia antes de marcar como tarde.</FieldHint>
            <FieldError msg={errors.lateTolerance?.message} />
          </div>
          <div>
            <Label htmlFor="lateDiscountPolicy" className="text-xs">Política de descuento</Label>
            <Controller
              control={control}
              name="lateDiscountPolicy"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="lateDiscountPolicy" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BY_MINUTE">Por minuto</SelectItem>
                    <SelectItem value="BY_RANGE">Por rangos</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Horas extra ── */}
      <Card className="shadow-none border">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Horas extra
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="overtimeEnabled" className="text-xs font-normal cursor-pointer">
                {overtimeEnabled ? 'Habilitado' : 'Deshabilitado'}
              </Label>
              <Controller
                control={control}
                name="overtimeEnabled"
                render={({ field }) => (
                  <Switch
                    id="overtimeEnabled"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>
        </CardHeader>
        {overtimeEnabled && (
          <CardContent className="px-5 pb-5">
            <Separator className="mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="overtimeBeforeMinutes" className="text-xs">Umbral antes del turno (min)</Label>
                <Input id="overtimeBeforeMinutes" type="number" min={0} max={120} className="mt-1" {...register('overtimeBeforeMinutes')} />
                <FieldHint>Minutos de margen antes de que cuente como H.E.</FieldHint>
              </div>
              <div>
                <Label htmlFor="overtimeFactorPct" className="text-xs">Recargo de horas extra</Label>
                <div className="relative mt-1">
                  <Input
                    id="overtimeFactorPct"
                    type="number"
                    min={0}
                    max={900}
                    step={0.1}
                    className="pr-8"
                    {...register('overtimeFactorPct')}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                </div>
                <FieldHint>% extra sobre la tarifa normal. 0 = sin recargo · 50 = paga ×1.5 · 100 = paga ×2.0</FieldHint>
                <FieldError msg={errors.overtimeFactorPct?.message} />
              </div>
              <div>
                <Label htmlFor="workdayHours" className="text-xs">Horas de jornada estándar</Label>
                <Input id="workdayHours" type="number" min={1} max={24} className="mt-1" {...register('workdayHours')} />
                <FieldHint>Se usa para calcular la tarifa/hora.</FieldHint>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Almuerzo ── */}
      <Card className="shadow-none border">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Almuerzo
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lunchDurationMinutes" className="text-xs">Duración esperada (minutos)</Label>
              <Input id="lunchDurationMinutes" type="number" min={0} max={180} className="mt-1" {...register('lunchDurationMinutes')} />
            </div>
            <div>
              <Label htmlFor="lunchDeductionType" className="text-xs">Tipo de descuento</Label>
              <Controller
                control={control}
                name="lunchDeductionType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="lunchDeductionType" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fijo (siempre descuenta la duración)</SelectItem>
                      <SelectItem value="REAL_TIME">Tiempo real (descuenta lo que dure)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="lunchRequired"
              render={({ field }) => (
                <Switch
                  id="lunchRequired"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="lunchRequired" className="text-sm font-normal cursor-pointer">
              Almuerzo obligatorio
              <span className="block text-xs text-muted-foreground">
                Jornada sin almuerzo genera incidencia automática.
              </span>
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* ── Ventanas de marcación ── */}
      <Card className="shadow-none border">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Ventanas de marcación
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Rangos horarios en que cada tipo de marcación es válida. El sistema clasifica
            automáticamente según la hora del día.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(
              [
                { label: 'Entrada', start: 'entryWindowStart', end: 'entryWindowEnd' },
                { label: 'Almuerzo', start: 'lunchWindowStart', end: 'lunchWindowEnd' },
                { label: 'Salida', start: 'exitWindowStart', end: 'exitWindowEnd' },
              ] as const
            ).map(({ label, start, end }) => (
              <div key={label}>
                <Label className="text-xs">{label}</Label>
                <div className="flex items-center gap-1.5 mt-1">
                  <Input type="time" {...register(start)} className="flex-1" />
                  <span className="text-muted-foreground text-xs">—</span>
                  <Input type="time" {...register(end)} className="flex-1" />
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxMarksPerDay" className="text-xs">Máx. marcaciones/día</Label>
              <Input id="maxMarksPerDay" type="number" min={2} max={10} className="mt-1" {...register('maxMarksPerDay')} />
              <FieldHint>Más de este número genera incidencia automática.</FieldHint>
            </div>
            <div>
              <Label htmlFor="lunchSkipHours" className="text-xs">Horas para salto de almuerzo</Label>
              <Input id="lunchSkipHours" type="number" min={1} max={12} className="mt-1" {...register('lunchSkipHours')} />
              <FieldHint>
                Si pasan estas horas tras la salida a almuerzo, la siguiente marca se toma como SALIDA.
              </FieldHint>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Acciones ── */}
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!isDirty}
          onClick={() => settings && reset(toForm(settings))}
        >
          Descartar
        </Button>
      </div>
    </form>
  )
}
