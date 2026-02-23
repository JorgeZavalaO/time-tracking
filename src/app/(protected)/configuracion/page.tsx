'use client'

import { Clock, SlidersHorizontal, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSchedules } from '@/hooks/useSchedules'
import { useDeleteSchedule } from '@/hooks/useScheduleMutations'
import { ScheduleForm } from '@/components/schedule/ScheduleForm'
import { SettingsForm } from '@/components/settings/SettingsForm'
import { BulkScheduleByTag } from '@/components/schedule/BulkScheduleByTag'

const DAY_LABELS: Record<string, string> = {
  MON: 'Lun', TUE: 'Mar', WED: 'Mié',
  THU: 'Jue', FRI: 'Vie', SAT: 'Sáb', SUN: 'Dom',
}

function formatDays(raw: string | string[]): string {
  const arr = Array.isArray(raw) ? raw : raw.split(',').map(d => d.trim())
  return arr.map(d => DAY_LABELS[d] ?? d).join(' · ')
}

function DeleteScheduleDialog({ id }: { id: number }) {
  const del = useDeleteSchedule()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          Eliminar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar horario?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Los colaboradores asignados a este horario
            quedarán sin horario especial.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() =>
              del.mutate(id, {
                onSuccess: () => toast.success('Horario eliminado'),
                onError: () => toast.error('No se pudo eliminar el horario'),
              })
            }
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default function ConfiguracionPage() {
  const { data: list = [], isFetching } = useSchedules(null)

  return (
    <section className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gestiona horarios, parámetros globales y políticas de la empresa.
        </p>
      </div>

      <Tabs defaultValue="horarios">
        <TabsList className="h-9 gap-0.5">
          <TabsTrigger value="horarios" className="gap-1.5 text-xs">
            <Clock className="size-3.5" />
            Horarios
          </TabsTrigger>
          <TabsTrigger value="parametros" className="gap-1.5 text-xs">
            <SlidersHorizontal className="size-3.5" />
            Parámetros
          </TabsTrigger>
          <TabsTrigger value="festivos" disabled className="gap-1.5 text-xs">
            <CalendarDays className="size-3.5" />
            Festivos
          </TabsTrigger>
        </TabsList>

        {/* ── Horarios ── */}
        <TabsContent value="horarios" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Jornadas laborales</p>
              <p className="text-xs text-muted-foreground">
                Define los horarios de entrada por tipo de jornada.
              </p>
            </div>
            <ScheduleForm />
          </div>

          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/40">
                  <TableHead className="w-14 text-xs">#</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Días</TableHead>
                  <TableHead className="text-xs">Entrada</TableHead>
                  <TableHead className="text-xs">Salida</TableHead>
                  <TableHead className="text-xs text-right w-36">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : list.length === 0
                    ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-12 text-center text-sm text-muted-foreground"
                          >
                            Sin horarios registrados
                          </TableCell>
                        </TableRow>
                      )
                    : list.map(h => (
                        <TableRow key={h.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {h.id}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={h.type === 'GENERAL' ? 'secondary' : 'outline'}
                              className="text-xs font-normal"
                            >
                              {h.type === 'GENERAL' ? 'General' : 'Especial'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{formatDays(h.days)}</TableCell>
                          <TableCell className="font-mono text-sm">{h.startTime}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {h.endTime ?? '—'}
                          </TableCell>
                          <TableCell className="text-right space-x-0.5">
                            <ScheduleForm
                              initialData={{
                                ...h,
                                days: Array.isArray(h.days)
                                  ? h.days as ('MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN')[]
                                  : (typeof h.days === 'string'
                                      ? h.days.split(',').map(d => d.trim()) as ('MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN')[]
                                      : []),
                              }}
                            />
                            <DeleteScheduleDialog id={h.id} />
                          </TableCell>
                        </TableRow>
                      ))}
              </TableBody>
            </Table>
          </Card>

          <BulkScheduleByTag />
        </TabsContent>

        {/* ── Parámetros ── */}
        <TabsContent value="parametros" className="mt-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Parámetros globales</CardTitle>
              <CardDescription>
                Configuración de tardanza, horas extra, almuerzo y ventanas de marcación.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsForm />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Festivos ── */}
        <TabsContent value="festivos" className="mt-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <CalendarDays className="size-10 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium">Próximamente</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  La gestión de días festivos estará disponible en una versión futura.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}
