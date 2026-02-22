'use client'
import { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { formatMinutes } from '@/lib/workday'
import {
  usePayrollSummary,
  useExportPayroll,
  type PayrollCycle,
  type PayrollSummary,
  type PayrollDaySummary,
} from '@/hooks/usePayroll'

// ─── Componente de desglose diario ────────────────────────────────────────

function DayDetailTable({ byDay }: { byDay: PayrollDaySummary[] }) {
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted text-muted-foreground">
            <th className="px-2 py-1 text-left">Fecha</th>
            <th className="px-2 py-1 text-left">Día</th>
            <th className="px-2 py-1 text-center">Prog.</th>
            <th className="px-2 py-1 text-center">Completa</th>
            <th className="px-2 py-1 text-right">Tard.</th>
            <th className="px-2 py-1 text-right">H.E.</th>
            <th className="px-2 py-1 text-right">Neto</th>
            <th className="px-2 py-1 text-right">Desc. (S/)</th>
            <th className="px-2 py-1 text-right">H.E. (S/)</th>
            <th className="px-2 py-1 text-left">Incidencias</th>
          </tr>
        </thead>
        <tbody>
          {byDay.map((d) => (
            <tr
              key={d.date}
              className={
                !d.isScheduledDay
                  ? 'text-muted-foreground opacity-50'
                  : d.incidences.length > 0
                  ? 'bg-red-50 dark:bg-red-950/20'
                  : ''
              }
            >
              <td className="px-2 py-0.5">{d.date}</td>
              <td className="px-2 py-0.5">{d.dayOfWeek}</td>
              <td className="px-2 py-0.5 text-center">{d.isScheduledDay ? '✓' : '—'}</td>
              <td className="px-2 py-0.5 text-center">{d.isDayComplete ? '✓' : '✗'}</td>
              <td className="px-2 py-0.5 text-right">{d.minutesLate > 0 ? `${d.minutesLate} min` : '—'}</td>
              <td className="px-2 py-0.5 text-right">{d.overtimeMinutes > 0 ? formatMinutes(d.overtimeMinutes) : '—'}</td>
              <td className="px-2 py-0.5 text-right">{formatMinutes(d.netMinutes)}</td>
              <td className="px-2 py-0.5 text-right text-destructive">
                {d.lateDiscountAmount > 0 ? `S/ ${d.lateDiscountAmount.toFixed(2)}` : '—'}
              </td>
              <td className="px-2 py-0.5 text-right text-emerald-600">
                {d.overtimeAmount > 0 ? `S/ ${d.overtimeAmount.toFixed(2)}` : '—'}
              </td>
              <td className="px-2 py-0.5 text-muted-foreground">
                {d.incidences.join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Fila resumen de un colaborador ──────────────────────────────────────

function CollaboratorRow({ item }: { item: PayrollSummary }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-2 font-medium">{item.collaboratorName}</td>
        <td className="px-4 py-2 text-center">{item.scheduledDays}</td>
        <td className="px-4 py-2 text-center">{item.workedDays}</td>
        <td className="px-4 py-2 text-center">
          {item.totalMinutesLate > 0
            ? <span className="text-amber-600">{item.totalMinutesLate} min</span>
            : '—'}
        </td>
        <td className="px-4 py-2 text-right">
          {item.totalLateDiscount > 0
            ? <span className="text-destructive">−S/ {item.totalLateDiscount.toFixed(2)}</span>
            : '—'}
        </td>
        <td className="px-4 py-2 text-center">
          {item.totalOvertimeMinutes > 0
            ? <span className="text-emerald-600">{formatMinutes(item.totalOvertimeMinutes)}</span>
            : '—'}
        </td>
        <td className="px-4 py-2 text-right">
          {item.totalOvertimePay > 0
            ? <span className="text-emerald-600">+S/ {item.totalOvertimePay.toFixed(2)}</span>
            : '—'}
        </td>
        <td className="px-4 py-2 text-right text-muted-foreground">
          S/ {item.baseSalary.toFixed(2)}
        </td>
        <td className="px-4 py-2 text-right font-semibold">
          S/ {item.totalNet.toFixed(2)}
        </td>
        <td className="px-4 py-2 text-center text-xs text-muted-foreground">
          {expanded ? '▲' : '▼'}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="px-4 pb-4 bg-muted/20">
            <DayDetailTable byDay={item.byDay} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────

const CYCLE_OPTIONS: { value: PayrollCycle; label: string }[] = [
  { value: 'MONTHLY',   label: 'Mensual' },
  { value: 'BIWEEKLY',  label: 'Quincenal' },
]

export default function PlanillaPage() {
  const [period, setPeriod]         = useState(() => dayjs().format('YYYY-MM'))
  const [cycle, setCycle]           = useState<PayrollCycle>('MONTHLY')
  const [half, setHalf]             = useState<1 | 2>(1)

  const { data, isLoading, isFetching } = usePayrollSummary(period, cycle, half)
  const exportMutation = useExportPayroll()

  const items = useMemo(() => data?.items ?? [], [data])

  // Totales para el footer
  const totals = useMemo(() => ({
    scheduledDays:      items.reduce((a, r) => a + r.scheduledDays, 0),
    workedDays:         items.reduce((a, r) => a + r.workedDays, 0),
    totalMinutesLate:   items.reduce((a, r) => a + r.totalMinutesLate, 0),
    totalLateDiscount:  parseFloat(items.reduce((a, r) => a + r.totalLateDiscount, 0).toFixed(2)),
    totalOvertimeMinutes: items.reduce((a, r) => a + r.totalOvertimeMinutes, 0),
    totalOvertimePay:   parseFloat(items.reduce((a, r) => a + r.totalOvertimePay, 0).toFixed(2)),
    totalBase:          parseFloat(items.reduce((a, r) => a + r.baseSalary, 0).toFixed(2)),
    totalNet:           parseFloat(items.reduce((a, r) => a + r.totalNet, 0).toFixed(2)),
  }), [items])

  async function handleExport() {
    try {
      await exportMutation.mutateAsync({ period, paymentCycle: cycle, half })
      toast.success('Planilla exportada')
    } catch {
      toast.error('Error al exportar la planilla')
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Pre-planilla</h1>
        <Button
          onClick={handleExport}
          disabled={exportMutation.isPending || items.length === 0}
          variant="outline"
        >
          {exportMutation.isPending ? 'Exportando…' : 'Exportar .xlsx'}
        </Button>
      </div>

      {/* ── Filtros ── */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Período */}
            <div>
              <Label htmlFor="period">Período</Label>
              <Input
                id="period"
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-40"
              />
            </div>

            {/* Ciclo */}
            <div>
              <Label htmlFor="cycle">Ciclo de pago</Label>
              <select
                id="cycle"
                className="border rounded-md px-2 py-2 text-sm w-36"
                value={cycle}
                onChange={(e) => setCycle(e.target.value as PayrollCycle)}
              >
                {CYCLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Quincena (solo BIWEEKLY) */}
            {cycle === 'BIWEEKLY' && (
              <div>
                <Label htmlFor="half">Quincena</Label>
                <select
                  id="half"
                  className="border rounded-md px-2 py-2 text-sm w-36"
                  value={half}
                  onChange={(e) => setHalf(Number(e.target.value) as 1 | 2)}
                >
                  <option value={1}>1ª quincena (1–15)</option>
                  <option value={2}>2ª quincena (16–fin)</option>
                </select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Tabla resumen ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resumen — {period}
            {cycle === 'BIWEEKLY' ? ` · Q${half}` : ''}
            {isFetching && !isLoading && (
              <span className="text-muted-foreground text-xs font-normal ml-2">actualizando…</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-sm">
              Calculando planilla…
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-sm">
              No hay colaboradores activos para mostrar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="px-4 py-2 text-left">Colaborador</th>
                    <th className="px-4 py-2 text-center">Días prog.</th>
                    <th className="px-4 py-2 text-center">Días trab.</th>
                    <th className="px-4 py-2 text-center">Tardanza</th>
                    <th className="px-4 py-2 text-right">Desc. tard.</th>
                    <th className="px-4 py-2 text-center">H. Extra</th>
                    <th className="px-4 py-2 text-right">Pago H.E.</th>
                    <th className="px-4 py-2 text-right">Sueldo base</th>
                    <th className="px-4 py-2 text-right">Total neto</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <CollaboratorRow key={item.collaboratorId} item={item} />
                  ))}
                </tbody>
                {/* Footer de totales */}
                <tfoot>
                  <tr className="border-t-2 bg-muted font-semibold text-sm">
                    <td className="px-4 py-2">TOTAL ({items.length} colaboradores)</td>
                    <td className="px-4 py-2 text-center">{totals.scheduledDays}</td>
                    <td className="px-4 py-2 text-center">{totals.workedDays}</td>
                    <td className="px-4 py-2 text-center">
                      {totals.totalMinutesLate > 0
                        ? `${totals.totalMinutesLate} min`
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-destructive">
                      {totals.totalLateDiscount > 0
                        ? `−S/ ${totals.totalLateDiscount.toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-center text-emerald-600">
                      {totals.totalOvertimeMinutes > 0
                        ? formatMinutes(totals.totalOvertimeMinutes)
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-emerald-600">
                      {totals.totalOvertimePay > 0
                        ? `+S/ ${totals.totalOvertimePay.toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      S/ {totals.totalBase.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      S/ {totals.totalNet.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
