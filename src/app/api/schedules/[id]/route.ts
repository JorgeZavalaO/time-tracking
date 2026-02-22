import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ScheduleType, AuditStatus } from "@prisma/client";
import { z } from "zod";
import { requireRole, Permissions } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  type: z.nativeEnum(ScheduleType).optional(),
  days: z
    .array(z.enum(["MON","TUE","WED","THU","FRI","SAT","SUN"]))
    .min(1)
    .optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

export async function PUT(req: NextRequest, ctx: unknown) {
  const { params } = ctx as { params: { id: string } }
  const authResult = await requireRole(...Permissions.SCHEDULE_WRITE)
  if (!authResult.ok) return authResult.response

  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ error: "ID inválido", code: "INVALID_ID" }, { status: 400 });
  }

  const raw = await req.json();
  const daysArray: string[] | undefined =
    raw.days == null
      ? undefined
      : Array.isArray(raw.days)
      ? raw.days
      : typeof raw.days === "string"
      ? raw.days.split(",").map((d: string) => d.trim())
      : undefined;

  const data = bodySchema.parse({ ...raw, days: daysArray });

  const prev = await prisma.schedule.findUnique({ where: { id } });
  if (!prev) {
    return NextResponse.json({ error: "Horario no encontrado", code: "NOT_FOUND" }, { status: 404 });
  }

  const updateData: Partial<import("@prisma/client").Schedule> = {};
  if (data.type) updateData.type = data.type;
  if (data.days) updateData.days = data.days;
  if (data.startTime) updateData.startTime = data.startTime;
  if ("endTime" in data) updateData.endTime = data.endTime ?? null;

  // Guardar schedule + historial enriquecido en transacción
  const [updated] = await prisma.$transaction([
    prisma.schedule.update({ where: { id }, data: updateData }),
    prisma.scheduleHistory.create({
      data: {
        scheduleId: id,
        oldStartTime: prev.startTime,
        newStartTime: data.startTime ?? prev.startTime,
        oldDays: prev.days,
        newDays: data.days ?? prev.days,
        oldType: prev.type,
        newType: data.type ?? prev.type,
        changedById: authResult.userId,
        reason: raw.reason ?? null,
      },
    }),
  ]);

  await logAudit({
    actorId: authResult.userId,
    actorRole: authResult.role,
    action: "UPDATE",
    resource: "SCHEDULE",
    resourceId: id,
    status: AuditStatus.SUCCESS,
    before: { startTime: prev.startTime, days: prev.days, type: prev.type },
    after: { startTime: updated.startTime, days: updated.days, type: updated.type },
    reason: raw.reason ?? null,
  })

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, ctx: unknown) {
  const { params } = ctx as { params: { id: string } }

  const authResult = await requireRole(...Permissions.SCHEDULE_DELETE)
  if (!authResult.ok) return authResult.response

  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ error: "ID inválido", code: "INVALID_ID" }, { status: 400 });
  }

  try {
    const before = await prisma.schedule.findUnique({
      where: { id },
      select: { type: true, startTime: true, days: true },
    })

    await prisma.schedule.delete({ where: { id } });

    await logAudit({
      actorId: authResult.userId,
      actorRole: authResult.role,
      action: "DELETE",
      resource: "SCHEDULE",
      resourceId: id,
      status: AuditStatus.SUCCESS,
      before,
    })

    return NextResponse.json({ message: "Horario eliminado" });
  } catch (e) {
    console.error("Error DELETE /schedules/[id]:", e);
    return NextResponse.json({ error: "No se pudo eliminar", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
