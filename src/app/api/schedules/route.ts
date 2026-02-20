import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ScheduleType } from "@prisma/client";
import { z } from "zod";

// ahora schema sólo valida array
const bodySchema = z.object({
  type: z.nativeEnum(ScheduleType),
  days: z
    .array(z.enum(["MON","TUE","WED","THU","FRI","SAT","SUN"]))
    .min(1, "Seleccione al menos un día"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "formato HH:mm (24h)"),
});

export async function GET(req: NextRequest) {
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
      days: data.days,       // requiere Schema.prisma: days String[]
      startTime: data.startTime,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
