'use client'
import dayjs from 'dayjs'
import { MARK_BADGE, MARK_LABELS, MarkType } from '@/hooks/useAccessRecords'
import { formatMinutes } from '@/lib/workday'
import type { WorkdaySummary } from '@/hooks/useDailySummary'

type Props = {
  marks: Array<{ id: number; markType: string; timestamp: string; status: string }>
  summary?: WorkdaySummary
  isLoading?: boolean
}

const STATUS_DOT: Record<string, string> = {
  ENTRY:     'bg-emerald-500',
  LUNCH_OUT: 'bg-sky-400',
  LUNCH_IN:  'bg-indigo-400',
  EXIT:      'bg-amber-500',
  INCIDENCE: 'bg-red-500',
}

export function DayTimeline({ marks, summary, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4 animate-pulse space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-5 bg-muted/40 rounded" />
        ))}
      </div>
    )
  }

  if (!marks || marks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        Sin marcaciones registradas este día
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Lista de marcaciones */}
      <div className="relative space-y-0">
        {marks.map((m, idx) => {
          const mt  = m.markType as MarkType
          const dot = STATUS_DOT[mt] ?? 'bg-gray-400'
          return (
            <div key={m.id} className="flex items-start gap-3">
              {/* Línea vertical con punto */}
              <div className="flex flex-col items-center">
                <div className={`h-3 w-3 rounded-full ring-2 ring-background ${dot} z-10 mt-1`} />
                {idx < marks.length - 1 && (
                  <div className="w-px flex-1 bg-border min-h-[1.5rem]" />
                )}
              </div>
              {/* Contenido */}
              <div className="flex items-center gap-2 pb-3 flex-1 min-w-0">
                <span className={`rounded px-2 py-0.5 text-xs font-medium shrink-0 ${MARK_BADGE[mt] ?? ''}`}>
                  {MARK_LABELS[mt] ?? mt}
                </span>
                <span className="text-sm font-mono text-muted-foreground">
                  {dayjs(m.timestamp).format('HH:mm')}
                </span>
                {m.status === 'LATE' && mt === 'ENTRY' && (
                  <span className="rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 text-xs">
                    Tarde
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bloque de métricas */}
      {summary && (
        <div className="border-t pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Metric label="Entrada"  value={summary.entryTime  ? dayjs(summary.entryTime).format('HH:mm')  : '—'} />
            <Metric label="Salida"   value={summary.exitTime   ? dayjs(summary.exitTime).format('HH:mm')   : '—'} />
            <Metric
              label="Tardanza"
              value={summary.minutesLate > 0 ? `${summary.minutesLate} min` : '—'}
              highlight={summary.minutesLate > 0 ? 'text-red-600 dark:text-red-400' : undefined}
            />
            <Metric label="Almuerzo" value={formatMinutes(summary.lunchMinutes)} />
            <Metric
              label="Neto"
              value={formatMinutes(summary.netMinutes)}
              highlight="font-semibold"
            />
            <Metric
              label="Extra"
              value={summary.overtimeMinutes > 0 ? formatMinutes(summary.overtimeMinutes) : '—'}
              highlight={summary.overtimeMinutes > 0 ? 'text-emerald-600 dark:text-emerald-400' : undefined}
            />
          </div>

          {/* Incidencias */}
          {summary.incidences.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {summary.incidences.map((inc, i) => (
                <span
                  key={i}
                  className="rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 text-xs"
                >
                  {inc}
                </span>
              ))}
            </div>
          )}

          {/* Estado de la jornada */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${summary.isDayComplete ? 'bg-emerald-500' : 'bg-amber-400'}`}
            />
            {summary.isDayComplete ? 'Jornada completa' : 'Jornada incompleta'}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function Metric({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: string
}) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${highlight ?? ''}`}>{value}</span>
    </div>
  )
}
