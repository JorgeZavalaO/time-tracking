import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ScheduleType } from "@prisma/client"

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") // GENERAL | SPECIAL | null

  const where = type && type in ScheduleType
    ? { type: type as ScheduleType }
    : {}

  const list = await prisma.schedule.findMany({
    where,
    select: {
      id: true,
      startTime: true,
      days: true,
      type: true,
    },
    orderBy: { id: "asc" },
  })

  return NextResponse.json(list)
}
