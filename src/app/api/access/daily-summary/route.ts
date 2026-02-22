/**
 * GET /api/access/daily-summary
 * Calcula WorkdaySummary on-demand para un colaborador+día.
 *
 * Query params:
 *   collaboratorId  number (requerido)
 *   date            "YYYY-MM-DD" (requerido)
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import dayjs from "dayjs"
import { prisma } from "@/lib/prisma"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { calculateWorkday } from "@/lib/workday"

const qSchema = z.object({
  collaboratorId: z.coerce.number().int().positive(),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
})

export async function GET(req: NextRequest) {
  const auth = await requireRole(...Permissions.COLLABORATOR_READ)
  if (!auth.ok) return auth.response

  const parsed = qSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { collaboratorId, date } = parsed.data

  const startOfDay = new Date(`${date}T00:00:00.000Z`)
  const endOfDay   = new Date(`${date}T23:59:59.999Z`)

  // Cargar marcaciones del día
  const marks = await prisma.access.findMany({
    where: { collaboratorId, timestamp: { gte: startOfDay, lte: endOfDay } },
    orderBy: { timestamp: "asc" },
  })

  if (marks.length === 0) {
    return NextResponse.json({
      entryTime:       null,
      exitTime:        null,
      lunchOutTime:    null,
      lunchInTime:     null,
      lunchMinutes:    0,
      grossMinutes:    null,
      netMinutes:      null,
      minutesLate:     0,
      overtimeMinutes: 0,
      isDayComplete:   false,
      incidences:      ["Sin registros para este día"],
      marks:           [],
    })
  }

  // Cargar colaborador + schedule
  const collaborator = await prisma.collaborator.findUnique({
    where: { id: collaboratorId },
    include: { scheduleSpecial: true },
  })
  if (!collaborator) {
    return NextResponse.json({ error: "Colaborador no encontrado" }, { status: 404 })
  }

  const firstMark  = dayjs(marks[0].timestamp)
  const dayOfWeek  = firstMark.format("ddd").toUpperCase().slice(0, 3)

  const schedule =
    collaborator.scheduleSpecial?.days.includes(dayOfWeek)
      ? collaborator.scheduleSpecial
      : await prisma.schedule.findFirst({
          where: { type: "GENERAL", days: { has: dayOfWeek } },
        })

  if (!schedule) {
    return NextResponse.json({ error: "Horario no configurado para este día" }, { status: 404 })
  }

  const settings = await prisma.companySettings.findUnique({ where: { id: 1 } })
  const cfg = {
    lateTolerance:        settings?.lateTolerance        ?? 0,
    lunchDurationMinutes: settings?.lunchDurationMinutes ?? 60,
    lunchDeductionType:   settings?.lunchDeductionType   ?? ("FIXED" as const),
    lunchRequired:        settings?.lunchRequired        ?? false,
    overtimeEnabled:      settings?.overtimeEnabled      ?? false,
    overtimeBeforeMinutes: settings?.overtimeBeforeMinutes ?? 0,
    overtimeAfterMinutes:  settings?.overtimeAfterMinutes  ?? 0,
    overtimeRoundMinutes:  settings?.overtimeRoundMinutes  ?? 15,
  }

  const summary = calculateWorkday(marks, cfg, schedule)

  // Serializar Dayjs → ISO string para JSON
  return NextResponse.json({
    ...summary,
    entryTime:    summary.entryTime?.toISOString()    ?? null,
    exitTime:     summary.exitTime?.toISOString()     ?? null,
    lunchOutTime: summary.lunchOutTime?.toISOString() ?? null,
    lunchInTime:  summary.lunchInTime?.toISOString()  ?? null,
  })
}
