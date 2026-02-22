'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useSchedules } from '@/hooks/useSchedules'
import { ScheduleForm } from '@/components/schedule/ScheduleForm'
import SkeletonRow from '@/components/skeleton/SkeletonRow'
import { SettingsForm } from '@/components/settings/SettingsForm'
import { BulkScheduleByTag } from '@/components/schedule/BulkScheduleByTag'


export default function ConfiguracionPage () {
  const { data: list = [], isFetching } = useSchedules(null)

  return (
    <section className='flex flex-col gap-6'>
      <h1 className='text-2xl font-semibold'>Panel de configuración</h1>

      <Tabs defaultValue='horarios' className='space-y-6'>
        <TabsList>
          <TabsTrigger value='horarios'>Horarios</TabsTrigger>
          <TabsTrigger value='parametros'>Parámetros</TabsTrigger>
          <TabsTrigger value='festivos' disabled>Festivos</TabsTrigger>
        </TabsList>

        <TabsContent value='horarios' className='space-y-4'>
          <div className='flex justify-between items-center'>
            <p className='text-muted-foreground'>Defina horas de ingreso por tipo de jornada.</p>
            <ScheduleForm />
          </div>

          <div className='overflow-x-auto rounded-lg border'>
            <table className='min-w-full border-collapse text-sm'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='p-3 text-left'>ID</th>
                  <th className='p-3 text-left'>Tipo</th>
                  <th className='p-3 text-left'>Días</th>
                  <th className='p-3 text-left'>Hora inicio</th>
                  <th className='p-3 text-center w-32'>Acciones</th>
                </tr>
              </thead>
              <tbody aria-busy={isFetching}>
                {isFetching
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                  : list.length === 0
                    ? (
                      <tr>
                        <td colSpan={5} className='p-4 text-center text-muted-foreground'>— Sin horarios —</td>
                      </tr>
                      )
                    : list.map(h => (
                      <tr key={h.id} className='hover:bg-accent/20'>
                        <td className='p-3'>{h.id}</td>
                        <td className='p-3'>{h.type === 'GENERAL' ? 'General' : 'Especial'}</td>
                        <td className='p-3'>{h.days}</td>
                        <td className='p-3'>{h.startTime}</td>
                        <td className='p-3 text-center space-x-2'>
                          <ScheduleForm initialData={{
                            ...h,
                            days: Array.isArray(h.days)
                              ? h.days
                              : (typeof h.days === 'string'
                                  ? h.days.split(',').map(d => d.trim()) as ("MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN")[]
                                  : [])
                          }} />
                        </td>
                      </tr>
                      ))}
              </tbody>
            </table>
          </div>

          <BulkScheduleByTag />
        </TabsContent>

        {/* Kiosks content removed */}

        <TabsContent value='festivos'>
          <p className='text-muted-foreground text-sm'>Gestión de días festivos llegará en una próxima versión.</p>
        </TabsContent>

        <TabsContent value='parametros' className='space-y-6'>
          <div>
            <p className='text-muted-foreground text-sm mb-6'>
              Configure los parámetros globales de tardanza, horas extra y almuerzo que aplican a toda la empresa.
            </p>
            <SettingsForm />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}
