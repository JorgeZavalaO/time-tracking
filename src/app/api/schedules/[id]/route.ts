import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ScheduleType } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";

const bodySchema = z.object({
  type: z.nativeEnum(ScheduleType).optional(),
  days: z
    .array(z.enum(["MON","TUE","WED","THU","FRI","SAT","SUN"]))
    .min(1)
    .optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function PUT(req: NextRequest, ctx: unknown) {
  const { params } = ctx as { params: { id: string } }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const raw = await req.json();
  // normalizamos days igual que en POST
  const daysArray: string[] | undefined =
    raw.days == null
      ? undefined
      : Array.isArray(raw.days)
      ? raw.days
      : typeof raw.days === "string"
      ? raw.days.split(",").map((d: string) => d.trim())
      : undefined;

  // validamos
  const data = bodySchema.parse({ ...raw, days: daysArray });

  const prev = await prisma.schedule.findUnique({ where: { id } });
  if (!prev) {
    return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });
  }

  const updateData: Partial<import("@prisma/client").Schedule> = {};
  if (data.type) updateData.type = data.type;
  if (data.days) updateData.days = data.days;
  if (data.startTime) updateData.startTime = data.startTime;

  // guardamos y dejamos historial
  const [updated] = await prisma.$transaction([
    prisma.schedule.update({ where: { id }, data: updateData }),
    prisma.scheduleHistory.create({
      data: {
        scheduleId: id,
        oldStartTime: prev.startTime,
        newStartTime: data.startTime ?? prev.startTime,
        changedById: Number(session.user.id),
      },
    }),
  ]);

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, ctx: unknown) {
  const { params } = ctx as { params: { id: string } }
  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  try {
    await prisma.schedule.delete({ where: { id } });
    return NextResponse.json({ message: "Horario eliminado" });
  } catch (e) {
    console.error("Error DELETE /schedules/[id]:", e);
    return NextResponse.json({ error: "No se pudo eliminar" }, { status: 500 });
  }
}
