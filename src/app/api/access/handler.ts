import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import type { AccessStatus, CompanySettings, MarkType } from "@prisma/client";
import { AuditStatus } from "@prisma/client";
import { compare } from "bcryptjs";
import { z } from "zod";
import { uploadSelfieFromDataUrl } from "@/lib/storage";
import { logAudit } from "@/lib/audit";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convierte "HH:mm" al mismo día que `ref` y devuelve un Dayjs. */
function timeToday(hhmm: string, ref: dayjs.Dayjs): dayjs.Dayjs {
  const [h, m] = hhmm.split(":").map(Number);
  return ref.hour(h).minute(m).second(0).millisecond(0);
}

/** true si `t` está en la ventana [start, end] (inclusive). */
function inWindow(t: dayjs.Dayjs, start: string, end: string, ref: dayjs.Dayjs): boolean {
  return !t.isBefore(timeToday(start, ref)) && !t.isAfter(timeToday(end, ref));
}

// ─── Clasificación automática ────────────────────────────────────────────────

type AccessRow = { markType: MarkType; timestamp: Date };
type ClassifyResult = {
  markType: MarkType;
  nextExpected: string | null;
  note: string | null;
};

export const MARK_LABELS: Record<MarkType, string> = {
  ENTRY:     "Entrada",
  LUNCH_OUT: "Salida a almuerzo",
  LUNCH_IN:  "Regreso de almuerzo",
  EXIT:      "Salida",
  INCIDENCE: "Incidencia",
};

export function classifyMark(
  todayMarks: AccessRow[],
  settings: Pick<
    CompanySettings,
    | "entryWindowStart" | "entryWindowEnd"
    | "lunchWindowStart" | "lunchWindowEnd"
    | "exitWindowStart"  | "exitWindowEnd"
    | "maxMarksPerDay"   | "lunchSkipHours"
  >,
  now: dayjs.Dayjs,
): ClassifyResult {
  const count = todayMarks.length;

  // Demasiadas marcaciones → INCIDENCE
  if (count >= settings.maxMarksPerDay) {
    return { markType: "INCIDENCE", nextExpected: null, note: "Máximo de marcaciones diarias alcanzado" };
  }

  // Sin marcaciones → ENTRY
  if (count === 0) {
    return { markType: "ENTRY", nextExpected: "Salida a almuerzo", note: null };
  }

  const lastMark = todayMarks[count - 1];
  const lastType = lastMark.markType;

  // Tras ENTRY
  if (lastType === "ENTRY") {
    if (inWindow(now, settings.lunchWindowStart, settings.lunchWindowEnd, now)) {
      return { markType: "LUNCH_OUT", nextExpected: "Regreso de almuerzo", note: null };
    }
    if (inWindow(now, settings.exitWindowStart, settings.exitWindowEnd, now)) {
      return {
        markType: "EXIT",
        nextExpected: null,
        note: "Almuerzo no registrado — se aplicará deducción por política",
      };
    }
    // Fuera de ventanas → asumir almuerzo por cercanía temporal
    return { markType: "LUNCH_OUT", nextExpected: "Regreso de almuerzo", note: null };
  }

  // Tras LUNCH_OUT
  if (lastType === "LUNCH_OUT") {
    const elapsedHours = now.diff(dayjs(lastMark.timestamp), "hour", true);
    if (elapsedHours >= settings.lunchSkipHours) {
      // Caso B flexible: demasiado tiempo → tomar como SALIDA
      return {
        markType: "EXIT",
        nextExpected: null,
        note: "Almuerzo incompleto — regreso no registrado",
      };
    }
    return { markType: "LUNCH_IN", nextExpected: "Salida", note: null };
  }

  // Tras LUNCH_IN → EXIT
  if (lastType === "LUNCH_IN") {
    return { markType: "EXIT", nextExpected: null, note: null };
  }

  // Tras EXIT (jornada cerrada) → INCIDENCE
  if (lastType === "EXIT") {
    return {
      markType: "INCIDENCE",
      nextExpected: null,
      note: "Jornada ya cerrada — marcación adicional registrada como incidencia",
    };
  }

  // Tras INCIDENCE → otra incidencia
  return { markType: "INCIDENCE", nextExpected: null, note: "Marcación adicional" };
}

// ─── Schema de validación ────────────────────────────────────────────────────

const bodySchema = z
  .object({
    method: z.enum(["DNI", "QR"]).default("DNI"),
    dni: z.string().optional(),
    qr_token: z.string().optional(),
    pin: z.string().regex(/^\d{4,8}$/),
    device_fingerprint: z.string().max(255).optional(),
    selfie_data_url: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.method === "DNI" && !val.dni) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "dni es requerido para method DNI" });
    }
    if (val.method === "QR" && !val.qr_token) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "qr_token es requerido para method QR" });
    }
  });

// ─── Handler principal ───────────────────────────────────────────────────────

export default async function handler(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json({ message: "Método no permitido" }, { status: 405 });
  }

  const payload = bodySchema.parse(await req.json());

  if (payload.method === "DNI" && !/^\d{8}$/.test(payload.dni!.trim())) {
    return NextResponse.json({ message: "DNI inválido" }, { status: 400 });
  }

  // 1. Buscar colaborador
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

  if (!collaborator) {
    await logAudit({
      action: "ACCESS_DENIED",
      resource: "ACCESS",
      status: AuditStatus.DENIED,
      error: "Colaborador no encontrado",
      metadata: { method: payload.method, dniFrag: payload.dni?.slice(-4), ip: req.headers.get("x-forwarded-for") },
    });
    return NextResponse.json({ message: "Colaborador no encontrado" }, { status: 404 });
  }

  if (!collaborator.active || !collaborator.is_active || collaborator.is_blocked) {
    await logAudit({
      action: "ACCESS_DENIED",
      resource: "ACCESS",
      resourceId: collaborator.id,
      status: AuditStatus.DENIED,
      error: collaborator.is_blocked ? "Colaborador bloqueado" : "Colaborador inactivo",
      metadata: { collaboratorId: collaborator.id, method: payload.method },
    });
    return NextResponse.json({ message: "Colaborador inactivo o bloqueado" }, { status: 403 });
  }

  if (!collaborator.pin_hash) {
    return NextResponse.json({ message: "PIN no configurado" }, { status: 400 });
  }

  const pinOk = await compare(payload.pin, collaborator.pin_hash);
  if (!pinOk) {
    await logAudit({
      action: "ACCESS_DENIED",
      resource: "ACCESS",
      resourceId: collaborator.id,
      status: AuditStatus.DENIED,
      error: "PIN inválido",
      metadata: { collaboratorId: collaborator.id, method: payload.method },
    });
    return NextResponse.json({ message: "PIN inválido" }, { status: 401 });
  }

  // 2. Detectar día y horario
  const today = dayjs().format("ddd").toUpperCase().slice(0, 3); // "MON", "TUE", …
  const schedule =
    collaborator.scheduleSpecial?.days.includes(today)
      ? collaborator.scheduleSpecial
      : await prisma.schedule.findFirst({
          where: { type: "GENERAL", days: { has: today } },
        });

  if (!schedule) {
    return NextResponse.json({ message: "Horario aún no configurado" }, { status: 500 });
  }

  // 3. Leer configuración global (con fallback a defaults)
  const settings = await prisma.companySettings.findUnique({ where: { id: 1 } }).catch(() => null);
  const cfg = {
    lateTolerance:    settings?.lateTolerance    ?? 0,
    entryWindowStart: settings?.entryWindowStart ?? "05:00",
    entryWindowEnd:   settings?.entryWindowEnd   ?? "11:00",
    lunchWindowStart: settings?.lunchWindowStart ?? "11:00",
    lunchWindowEnd:   settings?.lunchWindowEnd   ?? "15:30",
    exitWindowStart:  settings?.exitWindowStart  ?? "15:00",
    exitWindowEnd:    settings?.exitWindowEnd    ?? "23:00",
    maxMarksPerDay:   settings?.maxMarksPerDay   ?? 4,
    lunchSkipHours:   settings?.lunchSkipHours   ?? 4,
  };

  // 4. Marcaciones del colaborador en el día actual
  const startDay = dayjs().startOf("day").toDate();
  const endDay   = dayjs().endOf("day").toDate();
  const todayMarks = await prisma.access.findMany({
    where: { collaboratorId: collaborator.id, timestamp: { gte: startDay, lte: endDay } },
    select: { markType: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });

  // 5. Clasificar automáticamente
  const now = dayjs();
  const { markType, nextExpected, note } = classifyMark(todayMarks, cfg, now);

  // 6. Calcular tardanza (solo para ENTRY)
  const [hh, mm] = schedule.startTime.split(":").map(Number);
  const cutoff = now.hour(hh).minute(mm).second(0);
  const cutoffWithTolerance = cutoff.add(cfg.lateTolerance, "minute");
  const status = (
    markType === "ENTRY"
      ? now.isAfter(cutoffWithTolerance) ? "LATE" : "ON_TIME"
      : "ON_TIME"
  ) as AccessStatus;

  // Valor numérico de tardanza (positivo = tarde, 0 = a tiempo)
  const minutesLateRaw = markType === "ENTRY"
    ? Math.max(0, now.diff(cutoffWithTolerance, "minute"))
    : null;

  let suspiciousReason: string | null = null;
  let confidenceFlag = false;

  if (markType === "ENTRY" && minutesLateRaw !== null && minutesLateRaw > 120) {
    suspiciousReason = "Fuera de turno extremo";
    confidenceFlag = true;
  }

  if (markType === "INCIDENCE") {
    confidenceFlag = true;
    suspiciousReason = note ?? "Incidencia de marcación";
  }

  const ipRaw = req.headers.get("x-forwarded-for") ?? "";
  const ip = ipRaw.split(",")[0]?.trim() || null;

  // 7. Selfie opcional
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

  // 8. Crear registro
  const access = await prisma.access.create({
    data: {
      collaboratorId:    collaborator.id,
      markType,
      status,
      minutesLate:       minutesLateRaw,
      deviceFingerprint: payload.device_fingerprint ?? null,
      ip,
      photo_url:         photoUrl,
      suspicious_reason: suspiciousReason,
      confidence_flag:   confidenceFlag,
    },
  });

  await logAudit({
    action: "ACCESS_ATTEMPT",
    resource: "ACCESS",
    resourceId: access.id,
    status: AuditStatus.SUCCESS,
    after: {
      collaboratorId: collaborator.id,
      markType,
      accessStatus: status,
      method: payload.method,
      suspicious: confidenceFlag,
    },
    metadata: { ip, device_fingerprint: payload.device_fingerprint ?? null },
  });

  return NextResponse.json({
    markType,
    markLabel: MARK_LABELS[markType],
    status:           access.status,
    timestamp:        access.timestamp,
    minutesLate:      access.minutesLate,
    nextExpected,
    note,
    photo_url:        access.photo_url,
    confidence_flag:  access.confidence_flag,
    suspicious_reason: access.suspicious_reason,
  });
}

