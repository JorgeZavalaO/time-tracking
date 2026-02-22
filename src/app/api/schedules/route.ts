import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ScheduleType, AuditStatus } from "@prisma/client";
import { z } from "zod";
import { requireRole, Permissions } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";

// ahora schema sólo valida array
const bodySchema = z.object({
  type: z.nativeEnum(ScheduleType),
  days: z
    .array(z.enum(["MON","TUE","WED","THU","FRI","SAT","SUN"]))
    .min(1, "Seleccione al menos un día"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "formato HH:mm (24h)"),
});

export async function GET(req: NextRequest) {
  const authResult = await requireRole(...Permissions.SCHEDULE_READ)
  if (!authResult.ok) return authResult.response

  const typeParam = req.nextUrl.searchParams.get("type") as ScheduleType | null;
  const where = typeParam ? { type: typeParam } : {};
  const list = await prisma.schedule.findMany({
    where,
    select: { id: true, type: true, days: true, startTime: true },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const authResult = await requireRole(...Permissions.SCHEDULE_WRITE)
  if (!authResult.ok) return authResult.response

  // 1) leemos el body
  const raw = await req.json();

  // 2) normalizamos days: si llega string lo convertimos a array
  const daysArray: string[] = Array.isArray(raw.days)
    ? raw.days
    : typeof raw.days === "string"
    ? raw.days.split(",").map((d: string) => d.trim())
    : [];

  // 3) validamos con Zod (ahora days siempre es array)
  const data = bodySchema.parse({ ...raw, days: daysArray });

  // 4) creamos
  const created = await prisma.schedule.create({
    data: {
      type: data.type,
      days: data.days,
      startTime: data.startTime,
    },
  });

  await logAudit({
    actorId: authResult.userId,
    actorRole: authResult.role,
    action: "CREATE",
    resource: "SCHEDULE",
    resourceId: created.id,
    status: AuditStatus.SUCCESS,
    after: created,
  })

  return NextResponse.json(created, { status: 201 });
}
