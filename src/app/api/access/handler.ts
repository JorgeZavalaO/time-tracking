import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import type { AccessStatus } from "@prisma/client";
import { compare } from "bcryptjs";
import { z } from "zod";
import { uploadSelfieFromDataUrl } from "@/lib/storage";

const bodySchema = z
  .object({
    method: z.enum(["DNI", "QR"]).default("DNI"),
    dni: z.string().optional(),
    qr_token: z.string().optional(),
    pin: z.string().regex(/^\d{4,8}$/),
    kiosk_id: z.number().int().positive().optional(),
    device_fingerprint: z.string().max(255).optional(),
    kiosk_secret: z.string().optional(),
    selfie_data_url: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.method === "DNI" && !val.dni) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "dni es requerido para method DNI" })
    }
    if (val.method === "QR" && !val.qr_token) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "qr_token es requerido para method QR" })
    }
  })

export default async function handler(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json({ message: "Método no permitido" }, { status: 405 });
  }

  const payload = bodySchema.parse(await req.json());
  const kioskSecret = req.headers.get("x-kiosk-secret") ?? payload.kiosk_secret ?? "";
  const kioskIdHeader = req.headers.get("x-kiosk-id");
  const kioskId = payload.kiosk_id ?? (kioskIdHeader ? Number(kioskIdHeader) : NaN);

  const kiosk = kioskSecret && Number.isInteger(kioskId) && kioskId > 0
    ? await prisma.kioskDevice.findUnique({ where: { id: kioskId } })
    : null;

  if (!kiosk || !kiosk.is_active || !(await compare(kioskSecret, kiosk.secret_hash))) {
    return NextResponse.json({ message: "Kiosko no autorizado" }, { status: 401 });
  }

  // 1) Buscar colaborador
  const collaborator =
    payload.method === "DNI"
      ? await prisma.collaborator.findUnique({
          where: { dni: payload.dni!.trim() },
          include: { scheduleSpecial: true },
        })
      : await prisma.collaborator.findFirst({
          where: { qr_token: payload.qr_token!.replace(/^tt:/, "") },
          include: { scheduleSpecial: true },
        });

  if (payload.method === "DNI" && !/^\d{8}$/.test(payload.dni!.trim())) {
    return NextResponse.json({ message: "DNI inválido" }, { status: 400 });
  }

  if (!collaborator) {
    return NextResponse.json({ message: "Colaborador no encontrado" }, { status: 404 });
  }

  if (!collaborator.active || !collaborator.is_active || collaborator.is_blocked) {
    return NextResponse.json({ message: "Colaborador inactivo o bloqueado" }, { status: 403 });
  }

  if (!collaborator.pin_hash) {
    return NextResponse.json({ message: "PIN no configurado" }, { status: 400 });
  }

  const pinOk = await compare(payload.pin, collaborator.pin_hash);
  if (!pinOk) {
    return NextResponse.json({ message: "PIN inválido" }, { status: 401 });
  }

  // 2) Detección del día de hoy
  const today = dayjs().format("ddd").toUpperCase().slice(0, 3); // “MON”, “TUE”, …

  // 3) Elegir horario: si el special aplica hoy, uso ese, si no busco general que incluya today
  const schedule =
    collaborator.scheduleSpecial?.days.includes(today) ||
    false
      ? collaborator.scheduleSpecial
      : await prisma.schedule.findFirst({
          where: {
            type: "GENERAL",
            days: { has: today },
          },
        });

  if (!schedule) {
    return NextResponse.json({ message: "Horario aun no configurado" }, { status: 500 });
  }

  // 4) Evitar duplicados en el mismo día
  const startDay = dayjs().startOf("day").toDate();
  const endDay = dayjs().endOf("day").toDate();
  const existing = await prisma.access.findFirst({
    where: {
      collaboratorId: collaborator.id,
      timestamp: { gte: startDay, lte: endDay },
    },
  });
  if (existing) {
    return NextResponse.json({ message: "Ya registraste tu entrada" }, { status: 409 });
  }

  // 5) Calcular si llegó tarde
  const [h, m] = schedule.startTime.split(":").map(Number);
  const cutoff = dayjs().hour(h).minute(m).second(0);
  const now = dayjs();
  const status = (now.isAfter(cutoff) ? "LATE" : "ON_TIME") as AccessStatus;

  let suspiciousReason: string | null = null;
  let confidenceFlag = false;
  const minutesLate = now.diff(cutoff, "minute");
  if (minutesLate > 120) {
    suspiciousReason = "Fuera de turno extremo";
    confidenceFlag = true;
  }

  const ipRaw = req.headers.get("x-forwarded-for") ?? "";
  const ip = ipRaw.split(",")[0]?.trim() || null;

  let photoUrl: string | null = null;
  if (payload.selfie_data_url) {
    try {
      photoUrl = await uploadSelfieFromDataUrl({
        dataUrl: payload.selfie_data_url,
        collaboratorId: collaborator.id,
      });
      if (!photoUrl) {
        suspiciousReason = suspiciousReason ?? "Selfie no almacenada (storage no configurado)";
      }
    } catch {
      confidenceFlag = true;
      suspiciousReason = suspiciousReason ?? "Error al procesar selfie";
    }
  }

  // 6) Crear registro
  const access = await prisma.access.create({
    data: {
      collaboratorId: collaborator.id,
      status,
      kioskId: kiosk.id,
      deviceFingerprint: payload.device_fingerprint ?? null,
      ip,
      photo_url: photoUrl,
      suspicious_reason: suspiciousReason,
      confidence_flag: confidenceFlag,
    },
  });

  await prisma.kioskDevice.update({
    where: { id: kiosk.id },
    data: { last_seen: new Date() },
  });

  return NextResponse.json(
    {
      status: access.status,
      timestamp: access.timestamp,
      photo_url: access.photo_url,
      confidence_flag: access.confidence_flag,
      suspicious_reason: access.suspicious_reason,
    },
    { status: 200 }
  );
}
