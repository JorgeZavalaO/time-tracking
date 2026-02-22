/**
 * recalculateDay — recalcula minutesLate del ENTRY de un colaborador+día
 * tras una edición posterior (PATCH/DELETE de marcación).
 * Función interna; no es un endpoint HTTP.
 */
import dayjs from "dayjs"
import { prisma } from "@/lib/prisma"

/**
 * @param collaboratorId  ID del colaborador
 * @param date            "YYYY-MM-DD" del día a recalcular
 */
export async function recalculateDay(
  collaboratorId: number,
  date: string,
): Promise<void> {
  const startOfDay = new Date(`${date}T00:00:00.000Z`)
  const endOfDay   = new Date(`${date}T23:59:59.999Z`)

  // Cargar todas las marcaciones del día
  const marks = await prisma.access.findMany({
    where: { collaboratorId, timestamp: { gte: startOfDay, lte: endOfDay } },
    orderBy: { timestamp: "asc" },
  })

  const entryMark = marks.find((m) => m.markType === "ENTRY")
  if (!entryMark) return // Nada que recalcular si no hay ENTRY

  // Cargar schedule del colaborador para ese día
  const collaborator = await prisma.collaborator.findUnique({
    where: { id: collaboratorId },
    include: { scheduleSpecial: true },
  })
  if (!collaborator) return

  const entryDay = dayjs(entryMark.timestamp)
  const dayOfWeek = entryDay.format("ddd").toUpperCase().slice(0, 3) // "MON", "TUE"…

  const schedule =
    collaborator.scheduleSpecial?.days.includes(dayOfWeek)
      ? collaborator.scheduleSpecial
      : await prisma.schedule.findFirst({
          where: { type: "GENERAL", days: { has: dayOfWeek } },
        })

  if (!schedule) return

  // Cargar configuración
  const settings = await prisma.companySettings.findUnique({ where: { id: 1 } })
  const lateTolerance = settings?.lateTolerance ?? 0

  // Calcular nuevos minutesLate
  const [hh, mm] = schedule.startTime.split(":").map(Number)
  const cutoff            = entryDay.hour(hh).minute(mm).second(0).millisecond(0)
  const cutoffWithTolerance = cutoff.add(lateTolerance, "minute")
  const newMinutesLate    = Math.max(0, entryDay.diff(cutoffWithTolerance, "minute"))

  // Solo actualizar si el valor cambió
  if (entryMark.minutesLate !== newMinutesLate) {
    await prisma.access.update({
      where: { id: entryMark.id },
      data: { minutesLate: newMinutesLate },
    })
  }
}
