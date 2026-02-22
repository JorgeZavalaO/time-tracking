// Asignación masiva de horario especial a colaboradores por etiqueta
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"
import { AuditStatus } from "@prisma/client"

const bodySchema = z.object({
  tag: z.string().trim().min(1),
  scheduleSpecialId: z.number().int().positive().nullable(),
})

export async function POST(req: NextRequest) {
  const auth = await requireRole(...Permissions.SCHEDULE_WRITE)
  if (!auth.ok) return auth.response

  const data = bodySchema.parse(await req.json())

  const { count } = await prisma.collaborator.updateMany({
    where: { tags: { has: data.tag } },
    data: { scheduleSpecialId: data.scheduleSpecialId },
  })

  await logAudit({
    actorId: auth.userId,
    actorRole: auth.role,
    action: "UPDATE",
    resource: "COLLABORATOR",
    status: AuditStatus.SUCCESS,
    reason: `Asignación masiva por etiqueta "${data.tag}"`,
    metadata: {
      tag: data.tag,
      scheduleSpecialId: data.scheduleSpecialId,
      affectedCount: count,
    },
  })

  return NextResponse.json({ count })
}
