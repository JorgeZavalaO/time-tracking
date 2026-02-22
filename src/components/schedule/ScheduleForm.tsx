'use client'
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ScheduleType } from '@prisma/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DayPicker } from './DayPicker';
import { useSaveSchedule } from '@/hooks/useScheduleMutations';
import { toast } from 'sonner';

const schema = z.object({
  id: z.number().optional(),
  type: z.nativeEnum(ScheduleType),
  days: z
    .array(z.enum(['MON','TUE','WED','THU','FRI','SAT','SUN']))
    .min(1, 'Seleccione al menos un día'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
  endTime: z.string().optional().nullable().refine(
    (v) => !v || /^\d{2}:\d{2}$/.test(v),
    { message: 'Formato HH:mm' }
  ),
});
type FormData = z.infer<typeof schema>;

export function ScheduleForm({ initialData }: { initialData?: Partial<FormData> }) {
  const save = useSaveSchedule();
  const { register, handleSubmit, control, reset, formState: { errors } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: initialData
        ? {
            id: initialData.id,
            type: initialData.type!,
            days: initialData.days!,
            startTime: initialData.startTime!,
            endTime: initialData.endTime ?? null,
          }
        : {
            type: 'GENERAL',
            days: ['MON','TUE','WED','THU','FRI'],
            startTime: '08:30',
            endTime: null,
          },
    });

  function onSubmit(data: FormData) {
    save.mutate(
      { 
        ...data,
        days: data.days.join(','),
        endTime: data.endTime || null,  // normaliza '' → null
      },
      {
        onSuccess: () => {
          toast.success('Horario guardado');
        },
        onError: (e: unknown) => {
          const errorMessage =
            typeof e === 'object' && e !== null && 'error' in e
              ? (e as { error?: string }).error
              : undefined;
          toast.error(errorMessage ?? 'Error inesperado');
        },
      }
    );
  }

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open && initialData) {
          reset({
            id: initialData.id,
            type: initialData.type!,
            days: initialData.days!,
            startTime: initialData.startTime!,            endTime: initialData.endTime ?? null,          });
        }
      }}
    >
      <SheetTrigger asChild>
        <Button variant={initialData ? 'outline' : 'default'}>
          {initialData ? 'Editar' : 'Nuevo horario'}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[380px]">
        <SheetHeader>
          <SheetTitle>
            {initialData ? 'Editar' : 'Nuevo'} horario
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div>
            <Label>Tipo</Label>
            <select
              {...register('type')}
              className="border rounded-md px-2 py-1 w-full"
            >
              <option value="GENERAL">General</option>
              <option value="SPECIAL">Especial</option>
            </select>
          </div>

          <Controller
            name="days"
            control={control}
            render={({ field }) => (
              <div>
                <Label>Días</Label>
                <DayPicker value={field.value} onChange={field.onChange} />
                {errors.days && (
                  <p className="text-sm text-destructive">
                    {errors.days.message}
                  </p>
                )}
              </div>
            )}
          />

          <div>
            <Label>Hora inicio (HH:mm)</Label>
            <Input
              {...register('startTime')}
              placeholder="08:30"
            />
            {errors.startTime && (
              <p className="text-sm text-destructive">
                {errors.startTime.message}
              </p>
            )}
          </div>

          <div>
            <Label>Hora fin (HH:mm) <span className="text-muted-foreground text-xs">(opcional, para H.E. al final)</span></Label>
            <Input
              {...register('endTime')}
              placeholder="17:30"
            />
            {errors.endTime && (
              <p className="text-sm text-destructive">
                {errors.endTime.message}
              </p>
            )}
          </div>

          <SheetFooter className="flex justify-end gap-2">
            <SheetClose asChild>
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </SheetClose>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
