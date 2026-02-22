/**
 * GET /api/reports/incidences
 * Días con incidencias por colaborador en un rango de fechas.
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

  const items = data
    .map((collab) => {
      const incidentDays = collab.byDay.filter((d) => d.incidences.length > 0)
      const totalIncidences = incidentDays.reduce((a, d) => a + d.incidences.length, 0)

      return {
        collaboratorId:     collab.collaboratorId,
        collaboratorName:   collab.collaboratorName,
        position:           collab.position,
        daysWithIncidences: incidentDays.length,
        totalIncidences,
        detail: incidentDays.map((d) => ({
          date:       d.date,
          incidences: d.incidences,
        })),
      }
    })
    .filter((r) => r.daysWithIncidences > 0)
    .sort((a, b) => b.daysWithIncidences - a.daysWithIncidences)

  if (format === "json") {
    return NextResponse.json({ dateFrom, dateTo, items })
  }

  // Para export: una fila por colaborador × día × incidencia
  const headers = ["Colaborador", "Cargo", "Fecha", "Incidencia"]
  const rows: (string | number | null)[][] = []
  for (const item of items) {
    for (const day of item.detail) {
      for (const inc of day.incidences) {
        rows.push([item.collaboratorName, item.position ?? "—", day.date, inc])
      }
    }
  }
  const title = `Incidencias ${dateFrom} — ${dateTo}`

  if (format === "xlsx") {
    const body = toXlsx([{ name: "Incidencias", headers, rows }])
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="incidencias_${dateFrom}_${dateTo}.xlsx"`,
      },
    })
  }

  const buf = await toPdf(title, [{ name: "Incidencias", headers, rows }])
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="incidencias_${dateFrom}_${dateTo}.pdf"`,
    },
  })
}
