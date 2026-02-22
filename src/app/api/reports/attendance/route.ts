/**
 * GET /api/reports/attendance
 * Asistencia por colaborador en un rango de fechas.
 *
 * Query params:
 *   dateFrom  "YYYY-MM-DD" (requerido)
 *   dateTo    "YYYY-MM-DD" (requerido)
 *   collaboratorId  number (opcional)
 *   format    "json" | "xlsx" | "pdf"  (default: json)
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { loadReportData } from "@/lib/report-data"
import { toXlsx, toPdf } from "@/lib/export"
import { formatMinutes } from "@/lib/workday"

const qSchema = z.object({
  dateFrom:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  collaboratorId: z.coerce.number().int().positive().optional(),
  format:         z.enum(["json", "xlsx", "pdf"]).default("json"),
})

export async function GET(req: NextRequest) {
  const auth = await requireRole(...Permissions.COLLABORATOR_READ)
  if (!auth.ok) return auth.response

  const parsed = qSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { dateFrom, dateTo, collaboratorId, format } = parsed.data

  const { data } = await loadReportData(dateFrom, dateTo, collaboratorId)

  // Calcular resumen por colaborador
  const items = data.map((collab) => {
    const scheduledDays = collab.byDay.filter((d) => d.isScheduledDay).length
    const presentDays   = collab.byDay.filter((d) => d.isDayComplete).length
    const absentDays    = collab.byDay.filter((d) => d.isScheduledDay && !d.isDayComplete).length
    const totalNet      = collab.byDay.reduce((a, d) => a + (d.netMinutes ?? 0), 0)
    const attendancePct = scheduledDays > 0
      ? parseFloat(((presentDays / scheduledDays) * 100).toFixed(1))
      : 0

    return {
      collaboratorId:   collab.collaboratorId,
      collaboratorName: collab.collaboratorName,
      position:         collab.position,
      scheduledDays,
      presentDays,
      absentDays,
      totalNetMinutes: totalNet,
      attendancePct,
    }
  })

  if (format === "json") {
    return NextResponse.json({ dateFrom, dateTo, items })
  }

  // ── Export ──────────────────────────────────────────────────────────────
  const headers = [
    "Colaborador", "Cargo", "Días prog.", "Días pres.", "Ausencias",
    "Min. netos", "% Asistencia",
  ]
  const rows = items.map((r) => [
    r.collaboratorName,
    r.position ?? "—",
    r.scheduledDays,
    r.presentDays,
    r.absentDays,
    formatMinutes(r.totalNetMinutes),
    r.attendancePct != null ? `${r.attendancePct}%` : "—",
  ])
  const sheetTitle = `Asistencia ${dateFrom} — ${dateTo}`

  if (format === "xlsx") {
    const body = toXlsx([{ name: "Asistencia", headers, rows }])
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="asistencia_${dateFrom}_${dateTo}.xlsx"`,
      },
    })
  }

  // PDF
  const buf = await toPdf(sheetTitle, [{ name: "Asistencia", headers, rows }])
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="asistencia_${dateFrom}_${dateTo}.pdf"`,
    },
  })
}
