/**
 * GET /api/reports/tardiness
 * Ranking de tardanzas por colaborador en un rango de fechas.
 *
 * Query params:
 *   dateFrom  "YYYY-MM-DD" (requerido)
 *   dateTo    "YYYY-MM-DD" (requerido)
 *   format    "json" | "xlsx" | "pdf"  (default: json)
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { loadReportData } from "@/lib/report-data"
import { toXlsx, toPdf } from "@/lib/export"

const qSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format:   z.enum(["json", "xlsx", "pdf"]).default("json"),
})

export async function GET(req: NextRequest) {
  const auth = await requireRole(...Permissions.COLLABORATOR_READ)
  if (!auth.ok) return auth.response

  const parsed = qSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { dateFrom, dateTo, format } = parsed.data

  const { data } = await loadReportData(dateFrom, dateTo)

  // Calcular tardanzas por colaborador
  const items = data
    .map((collab) => {
      const lateDays        = collab.byDay.filter((d) => d.minutesLate > 0)
      const totalMinutesLate = lateDays.reduce((a, d) => a + d.minutesLate, 0)
      const avgMinutes      = lateDays.length > 0
        ? parseFloat((totalMinutesLate / lateDays.length).toFixed(1))
        : 0
      const maxSingleDay    = lateDays.length > 0
        ? Math.max(...lateDays.map((d) => d.minutesLate))
        : 0

      return {
        collaboratorId:   collab.collaboratorId,
        collaboratorName: collab.collaboratorName,
        position:         collab.position,
        daysLate:         lateDays.length,
        totalMinutesLate,
        avgMinutesPerLateDay: avgMinutes,
        maxSingleDayLate: maxSingleDay,
        detailByDay: lateDays.map((d) => ({ date: d.date, minutesLate: d.minutesLate })),
      }
    })
    .filter((item) => item.daysLate > 0)
    .sort((a, b) => b.totalMinutesLate - a.totalMinutesLate)
    // Añadir ranking
    .map((item, idx) => ({ rank: idx + 1, ...item }))

  if (format === "json") {
    return NextResponse.json({ dateFrom, dateTo, items })
  }

  const headers = [
    "#", "Colaborador", "Cargo", "Días tard.", "Min. total",
    "Promedio/día", "Máx. en un día",
  ]
  const rows = items.map((r) => [
    r.rank,
    r.collaboratorName,
    r.position ?? "—",
    r.daysLate,
    r.totalMinutesLate,
    r.avgMinutesPerLateDay,
    r.maxSingleDayLate,
  ])
  const title = `Ranking de tardanzas ${dateFrom} — ${dateTo}`

  if (format === "xlsx") {
    const body = toXlsx([{ name: "Tardanzas", headers, rows }])
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tardanzas_${dateFrom}_${dateTo}.xlsx"`,
      },
    })
  }

  const buf = await toPdf(title, [{ name: "Ranking de tardanzas", headers, rows }])
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tardanzas_${dateFrom}_${dateTo}.pdf"`,
    },
  })
}
