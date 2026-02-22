/**
 * Seed comprehensivo — Empresa Demo SAC
 * Cubre: usuarios (4 roles), schedules, 6 colaboradores, 2 meses de marcaciones,
 * snapshot CERRADO (enero 2026), snapshot BORRADOR (febrero 2026), ajustes,
 * auditoría, notificaciones e historial de horarios.
 *
 * Ejecutar:  pnpm prisma db seed
 */
import {
  PrismaClient,
  AccessStatus,
  ScheduleType,
  Role,
  MarkType,
  AuditStatus,
  PaymentType,
  LateDiscountPolicy,
  LunchDeductionType,
  SnapshotStatus,
} from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Construye un Date desde fecha "YYYY-MM-DD" y hora "HH:MM"
 * tratadas como hora local Lima (seed las almacena como UTC directo).
 */
function ts(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`)
}

/**
 * Crea las 4 marcaciones de un día completo:
 * ENTRY → LUNCH_OUT → LUNCH_IN → EXIT
 */
async function fullDay(
  collaboratorId: number,
  date: string,
  entryTime: string,
  minutesLate: number,  // minutos crudos de tardanza (0 = puntual)
  exitTime = "17:30",
  lunchOut = "13:00",
  lunchIn  = "14:00",
) {
  const late = minutesLate > 5  // tolerancia configurada en 5 min
  const entry = await prisma.access.create({
    data: {
      collaboratorId,
      timestamp:   ts(date, entryTime),
      status:      late ? AccessStatus.LATE : AccessStatus.ON_TIME,
      markType:    MarkType.ENTRY,
      minutesLate: minutesLate > 0 ? minutesLate : null,
    },
  })
  await prisma.access.createMany({
    data: [
      { collaboratorId, timestamp: ts(date, lunchOut), status: AccessStatus.ON_TIME, markType: MarkType.LUNCH_OUT },
      { collaboratorId, timestamp: ts(date, lunchIn),  status: AccessStatus.ON_TIME, markType: MarkType.LUNCH_IN  },
      { collaboratorId, timestamp: ts(date, exitTime), status: AccessStatus.ON_TIME, markType: MarkType.EXIT      },
    ],
  })
  return entry
}

/** Día incompleto: solo ENTRY (sin salida → incidencia visible en registros). */
async function incompleteDay(
  collaboratorId: number,
  date: string,
  entryTime: string,
  minutesLate: number,
) {
  const late = minutesLate > 5
  return prisma.access.create({
    data: {
      collaboratorId,
      timestamp:   ts(date, entryTime),
      status:      late ? AccessStatus.LATE : AccessStatus.ON_TIME,
      markType:    MarkType.ENTRY,
      minutesLate: minutesLate > 0 ? minutesLate : null,
    },
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── 0. Limpieza idempotente (orden inverso a las FK) ─────────────────────
  await prisma.payrollAdjustment.deleteMany()
  await prisma.payrollSnapshot.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.scheduleHistory.deleteMany()
  await prisma.accessEditHistory.deleteMany()
  await prisma.justification.deleteMany()
  await prisma.access.deleteMany()
  await prisma.collaborator.deleteMany()
  await prisma.schedule.deleteMany()
  await prisma.companySettings.deleteMany()
  await prisma.user.deleteMany()

  // ── 1. Configuración de empresa (singleton id=1) ─────────────────────────
  await prisma.companySettings.create({
    data: {
      id:                    1,
      companyName:           "Empresa Demo SAC",
      ruc:                   "20123456789",
      timezone:              "America/Lima",
      lateTolerance:         5,
      lateDiscountPolicy:    LateDiscountPolicy.BY_MINUTE,
      overtimeEnabled:       true,
      overtimeBeforeMinutes: 0,
      overtimeAfterMinutes:  30,
      overtimeRoundMinutes:  15,
      overtimeFactor:        1.5,
      workdayHours:          8,
      lunchDurationMinutes:  60,
      lunchDeductionType:    LunchDeductionType.FIXED,
      lunchRequired:         true,
      entryWindowStart:      "05:00",
      entryWindowEnd:        "11:00",
      lunchWindowStart:      "12:00",
      lunchWindowEnd:        "15:30",
      exitWindowStart:       "15:00",
      exitWindowEnd:         "23:00",
      maxMarksPerDay:        4,
      lunchSkipHours:        4,
    },
  })

  // ── 2. Usuarios — 4 roles del sistema ────────────────────────────────────
  const [admin, rrhh, supervisor] = await Promise.all([
    prisma.user.create({
      data: {
        email:    "admin@demo.com",
        password: await bcrypt.hash("Admin123!", 10),
        name:     "Admin Demo",
        role:     Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        email:    "rrhh@demo.com",
        password: await bcrypt.hash("Rrhh123!", 10),
        name:     "Rosa RRHH",
        role:     Role.RRHH,
      },
    }),
    prisma.user.create({
      data: {
        email:    "supervisor@demo.com",
        password: await bcrypt.hash("Supervisor123!", 10),
        name:     "Sergio Supervisor",
        role:     Role.SUPERVISOR,
      },
    }),
    prisma.user.create({
      data: {
        email:    "readonly@demo.com",
        password: await bcrypt.hash("Readonly123!", 10),
        name:     "Rebeca Oficial",
        role:     Role.READ_ONLY,
      },
    }),
  ])

  // ── 3. Horarios ──────────────────────────────────────────────────────────
  const generalSchedule = await prisma.schedule.create({
    data: {
      type:      ScheduleType.GENERAL,
      days:      ["MON", "TUE", "WED", "THU", "FRI"],
      startTime: "08:30",
      endTime:   "17:30",
    },
  })

  const specialSchedule = await prisma.schedule.create({
    data: {
      type:      ScheduleType.SPECIAL,
      days:      ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      startTime: "09:00",
      endTime:   "18:00",
    },
  })

  // ── 4. Colaboradores (6) ─────────────────────────────────────────────────
  const [juan, maria, carlos, ana, luis, sofia] = await Promise.all([
    // 1. Juan Pérez — puntual en general, tardanzas ocasionales + OT
    prisma.collaborator.create({
      data: {
        dni:         "12345678",
        name:        "Juan Pérez",
        position:    "Analista de sistemas",
        hireDate:    new Date("2023-03-01"),
        salary:      3500,
        paymentType: PaymentType.MONTHLY,
        active:      true,
        is_active:   true,
        qr_token:    randomUUID(),
        pin_hash:    await bcrypt.hash("1234", 10),
        tags:        ["tecnologia", "sistemas"],
      },
    }),
    // 2. María López — asistencia perfecta, referente de puntualidad
    prisma.collaborator.create({
      data: {
        dni:         "87654321",
        name:        "María López",
        position:    "Contadora",
        hireDate:    new Date("2022-01-10"),
        salary:      4200,
        paymentType: PaymentType.MONTHLY,
        active:      true,
        is_active:   true,
        qr_token:    randomUUID(),
        pin_hash:    await bcrypt.hash("2234", 10),
        tags:        ["contabilidad", "finanzas"],
      },
    }),
    // 3. Carlos Quispe — horario especial MON-SAT, trabajo de campo
    prisma.collaborator.create({
      data: {
        dni:               "45678901",
        name:              "Carlos Quispe",
        position:          "Técnico de campo",
        hireDate:          new Date("2023-07-15"),
        salary:            3200,
        paymentType:       PaymentType.MONTHLY,
        active:            true,
        is_active:         true,
        qr_token:          randomUUID(),
        pin_hash:          await bcrypt.hash("3234", 10),
        tags:              ["tecnico", "campo"],
        scheduleSpecialId: specialSchedule.id,
      },
    }),
    // 4. Ana Torres — muchas tardanzas, ausencias frecuentes, BIWEEKLY
    prisma.collaborator.create({
      data: {
        dni:         "23456789",
        name:        "Ana Torres",
        position:    "Asistente administrativa",
        hireDate:    new Date("2024-02-20"),
        salary:      2800,
        paymentType: PaymentType.BIWEEKLY,
        active:      true,
        is_active:   true,
        qr_token:    randomUUID(),
        pin_hash:    await bcrypt.hash("4234", 10),
        tags:        ["administracion"],
      },
    }),
    // 5. Luis Mendoza — jefe, sin tardanzas, genera mucho OT
    prisma.collaborator.create({
      data: {
        dni:         "56789012",
        name:        "Luis Mendoza",
        position:    "Jefe de operaciones",
        hireDate:    new Date("2021-08-01"),
        salary:      3800,
        paymentType: PaymentType.MONTHLY,
        active:      true,
        is_active:   true,
        qr_token:    randomUUID(),
        pin_hash:    await bcrypt.hash("5234", 10),
        tags:        ["operaciones", "jefatura"],
      },
    }),
    // 6. Sofía Ramos — baja asistencia, BIWEEKLY
    prisma.collaborator.create({
      data: {
        dni:         "34567890",
        name:        "Sofía Ramos",
        position:    "Auxiliar de almacén",
        hireDate:    new Date("2024-09-01"),
        salary:      2600,
        paymentType: PaymentType.BIWEEKLY,
        active:      true,
        is_active:   true,
        qr_token:    randomUUID(),
        pin_hash:    await bcrypt.hash("6234", 10),
        tags:        ["almacen", "logistica"],
      },
    }),
  ])

  // ── 5. Marcaciones — ENERO 2026 ──────────────────────────────────────────
  // Enero tiene 22 días hábiles (MON-FRI): 1,2 + 5-9 + 12-16 + 19-23 + 26-30
  // Carlos tiene 26 días (incluye sábados): + 3 + 10 + 17 + 24 + 31

  // ─ Semana 1: 5-9 enero ───────────────────────────────────────────────────
  // JUAN — martes tarde con justificación
  await fullDay(juan.id, "2026-01-05", "08:25", 0)
  const jLate0106 = await fullDay(juan.id, "2026-01-06", "08:50", 20)   // 20 min tarde
  await prisma.justification.create({
    data: { accessId: jLate0106.id, reason: "Tráfico en av. Javier Prado", createdById: rrhh.id },
  })
  await fullDay(juan.id, "2026-01-07", "08:28", 0)
  await fullDay(juan.id, "2026-01-08", "08:30", 0, "18:20")             // 50 min OT
  await fullDay(juan.id, "2026-01-09", "08:25", 0)

  // MARÍA — semana perfecta
  for (const [d, h] of [
    ["2026-01-05","08:28"],["2026-01-06","08:29"],["2026-01-07","08:30"],
    ["2026-01-08","08:27"],["2026-01-09","08:30"],
  ] as [string,string][]) {
    await fullDay(maria.id, d, h, 0)
  }

  // LUIS — semana perfecta + OT el viernes
  await fullDay(luis.id, "2026-01-05", "08:30", 0)
  await fullDay(luis.id, "2026-01-06", "08:30", 0)
  await fullDay(luis.id, "2026-01-07", "08:30", 0)
  await fullDay(luis.id, "2026-01-08", "08:30", 0)
  await fullDay(luis.id, "2026-01-09", "08:30", 0, "18:00")             // 30 min OT

  // ─ Semana 2: 12-16 enero ─────────────────────────────────────────────────
  // JUAN — lunes tarde sin justificación
  await fullDay(juan.id, "2026-01-12", "08:40", 10)                     // 10 min tarde
  await fullDay(juan.id, "2026-01-13", "08:30", 0)
  await fullDay(juan.id, "2026-01-14", "08:28", 0)
  await fullDay(juan.id, "2026-01-15", "08:30", 0)
  await fullDay(juan.id, "2026-01-16", "08:30", 0)

  // ANA — múltiples tardanzas + incidencia (día incompleto) el miércoles
  const aLate0112 = await fullDay(ana.id, "2026-01-12", "08:55", 25)    // 25 min tarde
  await prisma.justification.create({
    data: { accessId: aLate0112.id, reason: "Problema con el transporte público", createdById: rrhh.id },
  })
  await fullDay(ana.id, "2026-01-13", "08:48", 18)                      // 18 min tarde
  await incompleteDay(ana.id, "2026-01-14", "08:30", 0)                 // entró pero no fichó salida → incidencia
  await fullDay(ana.id, "2026-01-15", "09:00", 30)                      // 30 min tarde
  // Jan 16 Ana: AUSENTE

  // SOFÍA — lunes tarde semana 2, resto ausente semana 2
  await fullDay(sofia.id, "2026-01-12", "08:45", 15)                    // 15 min tarde
  await fullDay(sofia.id, "2026-01-13", "08:30", 0)
  // Jan 14, 15, 16 Sofia: AUSENTE

  // CARLOS (09:00-18:00 MON-SAT) — martes tarde con justificación + sábado
  await fullDay(carlos.id, "2026-01-12", "09:00", 0, "18:00")
  const cLate0113 = await fullDay(carlos.id, "2026-01-13", "09:12", 12, "18:00")  // 12 min tarde
  await prisma.justification.create({
    data: { accessId: cLate0113.id, reason: "Revisión de vehículo de campo antes de salida", createdById: admin.id },
  })
  await fullDay(carlos.id, "2026-01-14", "09:00", 0, "18:00")
  await fullDay(carlos.id, "2026-01-15", "09:00", 0, "18:00")
  await fullDay(carlos.id, "2026-01-16", "09:00", 0, "18:00")
  await fullDay(carlos.id, "2026-01-17", "09:00", 0, "18:00")           // Sábado

  // ─ Semana 3: 19-23 enero ─────────────────────────────────────────────────
  // JUAN — lunes y miércoles AUSENTE; jueves con OT
  // Jan 19, Jan 21: sin registros
  await fullDay(juan.id, "2026-01-20", "08:30", 0)
  await fullDay(juan.id, "2026-01-22", "08:25", 0, "18:05")             // 35 min OT
  await fullDay(juan.id, "2026-01-23", "08:28", 0)

  // LUIS — dos días OT (lunes y miércoles)
  await fullDay(luis.id, "2026-01-19", "08:30", 0, "18:15")             // 45 min OT
  await fullDay(luis.id, "2026-01-20", "08:30", 0)
  await fullDay(luis.id, "2026-01-21", "08:30", 0)
  await fullDay(luis.id, "2026-01-22", "08:30", 0, "18:00")             // 30 min OT
  await fullDay(luis.id, "2026-01-23", "08:30", 0)

  // ANA — miércoles y viernes AUSENTE; lunes casi puntual; martes muy tarde
  await fullDay(ana.id, "2026-01-19", "08:35",  5)                      // 5 min (en tolerancia)
  await fullDay(ana.id, "2026-01-20", "09:07", 37)                      // 37 min tarde
  // Jan 21, Jan 23 Ana: AUSENTE
  await fullDay(ana.id, "2026-01-22", "08:30", 0)

  // CARLOS — semana normal + sábado con OT
  for (const d of ["2026-01-19","2026-01-20","2026-01-21","2026-01-22","2026-01-23"]) {
    await fullDay(carlos.id, d, "09:00", 0, "18:00")
  }
  await fullDay(carlos.id, "2026-01-24", "09:04", 4, "19:00")           // Sábado: ~dentro tolerancia + 60 min OT

  // MARÍA — semanas 3 y 4 perfectas
  for (const d of [
    "2026-01-19","2026-01-20","2026-01-21","2026-01-22","2026-01-23",
    "2026-01-26","2026-01-27","2026-01-28","2026-01-29","2026-01-30",
  ]) {
    await fullDay(maria.id, d, "08:29", 0)
  }

  // ─ Semana 4: 26-30 enero ─────────────────────────────────────────────────
  // JUAN — lunes tarde con justificación
  const jLate0126 = await fullDay(juan.id, "2026-01-26", "08:55", 25)   // 25 min tarde
  await prisma.justification.create({
    data: { accessId: jLate0126.id, reason: "Accidente de tránsito bloqueó la ruta", createdById: rrhh.id },
  })
  await fullDay(juan.id, "2026-01-27", "08:28", 0)
  await fullDay(juan.id, "2026-01-28", "08:30", 0)
  await fullDay(juan.id, "2026-01-29", "08:30", 0)
  await fullDay(juan.id, "2026-01-30", "08:30", 0)

  // LUIS — semana 4 + OT martes (carga de cierre de mes)
  await fullDay(luis.id, "2026-01-26", "08:30", 0)
  await fullDay(luis.id, "2026-01-27", "08:30", 0, "19:00")             // 90 min OT → round a 90 min
  await fullDay(luis.id, "2026-01-28", "08:30", 0)
  await fullDay(luis.id, "2026-01-29", "08:30", 0)
  await fullDay(luis.id, "2026-01-30", "08:30", 0)

  // SOFÍA — solo 3 días semana 4 (ausente lunes y martes)
  await fullDay(sofia.id, "2026-01-28", "08:30", 0)
  await fullDay(sofia.id, "2026-01-29", "08:30", 0)
  await fullDay(sofia.id, "2026-01-30", "08:45", 15)                    // 15 min tarde

  // CARLOS — semana 4 + sábado 31
  for (const d of ["2026-01-26","2026-01-27","2026-01-28","2026-01-29","2026-01-30"]) {
    await fullDay(carlos.id, d, "09:00", 0, "18:00")
  }
  await fullDay(carlos.id, "2026-01-31", "09:00", 0, "18:00")           // Sábado

  // ── 6. Marcaciones — FEBRERO 2026 ───────────────────────────────────────
  // Feb 2026: 20 días hábiles MON-FRI (5 semanas × 4 días + 1 = 16? No: 2,3,4,5,6 + 9-13 + 16-20 + 23-27 = 20)
  // Seeded hasta Feb 20 (semanas 1-3 = 15 días)

  // ─ Semana 1 feb: 2-6 ─────────────────────────────────────────────────────
  // JUAN
  await fullDay(juan.id, "2026-02-02", "08:28", 0)
  await fullDay(juan.id, "2026-02-03", "08:30", 0)
  await fullDay(juan.id, "2026-02-04", "08:48", 18)                     // 18 min tarde
  await fullDay(juan.id, "2026-02-05", "08:30", 0)
  await fullDay(juan.id, "2026-02-06", "08:30", 0)

  // MARÍA
  for (const d of ["2026-02-02","2026-02-03","2026-02-04","2026-02-05","2026-02-06"]) {
    await fullDay(maria.id, d, "08:28", 0)
  }

  // LUIS
  for (const d of ["2026-02-02","2026-02-03","2026-02-04","2026-02-05","2026-02-06"]) {
    await fullDay(luis.id, d, "08:30", 0)
  }

  // ANA — lunes muy tarde, resto ausente semana 1 feb
  await fullDay(ana.id, "2026-02-02", "09:02", 32)                      // 32 min tarde
  await fullDay(ana.id, "2026-02-03", "08:30", 0)
  // Feb 4, 5, 6 Ana: AUSENTE

  // SOFÍA — solo 3 días
  await fullDay(sofia.id, "2026-02-02", "08:30", 0)
  await fullDay(sofia.id, "2026-02-03", "08:42", 12)                    // 12 min tarde
  await fullDay(sofia.id, "2026-02-04", "08:30", 0)
  // Feb 5, 6 Sofía: AUSENTE

  // CARLOS — semana completa + sábado
  for (const d of ["2026-02-02","2026-02-03","2026-02-04","2026-02-05","2026-02-06"]) {
    await fullDay(carlos.id, d, "09:00", 0, "18:00")
  }
  await fullDay(carlos.id, "2026-02-07", "09:00", 0, "18:00")           // Sábado

  // ─ Semana 2 feb: 9-13 ────────────────────────────────────────────────────
  // JUAN — jueves con OT
  await fullDay(juan.id, "2026-02-09", "08:30", 0)
  await fullDay(juan.id, "2026-02-10", "08:30", 0)
  await fullDay(juan.id, "2026-02-11", "08:30", 0)
  await fullDay(juan.id, "2026-02-12", "08:30", 0, "18:00")             // 30 min OT
  await fullDay(juan.id, "2026-02-13", "08:30", 0)

  // MARÍA
  for (const d of ["2026-02-09","2026-02-10","2026-02-11","2026-02-12","2026-02-13"]) {
    await fullDay(maria.id, d, "08:29", 0)
  }

  // LUIS — lunes con 60 min OT (pre-planificación)
  await fullDay(luis.id, "2026-02-09", "08:30", 0, "18:30")             // 60 min OT
  await fullDay(luis.id, "2026-02-10", "08:30", 0)
  await fullDay(luis.id, "2026-02-11", "08:30", 0)
  await fullDay(luis.id, "2026-02-12", "08:30", 0)
  await fullDay(luis.id, "2026-02-13", "08:30", 0)

  // ANA — martes tarde, jueves y viernes AUSENTE
  await fullDay(ana.id, "2026-02-09", "08:30", 0)
  await fullDay(ana.id, "2026-02-10", "08:55", 25)                      // 25 min tarde
  await fullDay(ana.id, "2026-02-11", "08:30", 0)
  // Feb 12, 13 Ana: AUSENTE

  // SOFÍA y CARLOS — semana completa
  for (const d of ["2026-02-09","2026-02-10","2026-02-11","2026-02-12","2026-02-13"]) {
    await fullDay(sofia.id,  d, "08:30", 0)
    await fullDay(carlos.id, d, "09:00", 0, "18:00")
  }
  await fullDay(carlos.id, "2026-02-14", "09:00", 0, "18:00")           // Sábado

  // ─ Semana 3 feb: 16-20 ───────────────────────────────────────────────────
  // JUAN, MARÍA, LUIS, CARLOS — semana normal
  for (const d of ["2026-02-16","2026-02-17","2026-02-18","2026-02-19","2026-02-20"]) {
    await fullDay(juan.id,   d, "08:30", 0)
    await fullDay(maria.id,  d, "08:28", 0)
    await fullDay(luis.id,   d, "08:30", 0)
    await fullDay(carlos.id, d, "09:00", 0, "18:00")
  }
  await fullDay(carlos.id, "2026-02-21", "09:00", 0, "18:00")           // Sábado

  // ANA — lunes muy tarde + incidencia miércoles (sin salida)
  await fullDay(ana.id, "2026-02-16", "09:10", 40)                      // 40 min tarde
  await fullDay(ana.id, "2026-02-17", "08:30", 0)
  await incompleteDay(ana.id, "2026-02-18", "08:30", 0)                 // sin salida → incidencia
  // Feb 19, 20 Ana: AUSENTE

  // SOFÍA — solo lunes, resto AUSENTE semana 3
  await fullDay(sofia.id, "2026-02-16", "08:30", 0)
  // Feb 17-20 Sofía: AUSENTE

  // ── 7. Snapshot CERRADO — Enero 2026 (MONTHLY) ──────────────────────────
  // Valores calculados: lateTolerance=5 min, workdayHours=8, overtimeFactor=1.5
  // overtimeAfterMinutes=30 (mínimo para contar OT), overtimeRoundMinutes=15
  // hourlyRate = salary / (scheduledDays × workdayHours)
  //
  // Enero 2026: 22 días MON-FRI | Carlos: 26 días MON-SAT
  // ─────────────────────────────────────────────────────────────────────────
  // Juan  : 3500/(22×8)=19.89/h | lat_net=40min→13.26 | OT=75min→37.29 | net=3524.03
  // María : 4200/(22×8)=23.86/h | perfecta              | net=4200.00
  // Carlos: 3200/(26×8)=15.38/h | lat_net=8min→2.05   | OT=60min→23.07 | net=3221.02
  // Ana   : 2800/(22×8)=15.91/h | lat_net=70min→18.56  | net=2781.44
  // Luis  : 3800/(22×8)=21.59/h | OT=195min→89.07      | net=3889.07
  // Sofía : 2600/(22×8)=14.77/h | lat_net=25min→6.15   | net=2593.85
  // Items sum = 20209.41 | Ajustes: +150 -50 = +100 | totalNet = 20309.41

  const baseSettings = {
    lateTolerance: 5, lunchDurationMinutes: 60, lunchDeductionType: "FIXED",
    lunchRequired: true, overtimeEnabled: true, overtimeBeforeMinutes: 0,
    overtimeAfterMinutes: 30, overtimeRoundMinutes: 15, lateDiscountPolicy: "BY_MINUTE",
    workdayHours: 8, overtimeFactor: 1.5,
  }

  const janItems = [
    { collaboratorId: juan.id,   collaboratorName: "Juan Pérez",          period: "2026-01", paymentCycle: "MONTHLY",
      baseSalary: 3500,   hourlyRate: 19.89, scheduledDays: 22, workedDays: 20,
      totalMinutesLate: 55,  totalLateDiscount: 13.26, totalOvertimeMinutes: 75,  totalOvertimePay: 37.29, totalNet: 3524.03 },
    { collaboratorId: maria.id,  collaboratorName: "María López",         period: "2026-01", paymentCycle: "MONTHLY",
      baseSalary: 4200,   hourlyRate: 23.86, scheduledDays: 22, workedDays: 22,
      totalMinutesLate: 0,   totalLateDiscount: 0,     totalOvertimeMinutes: 0,   totalOvertimePay: 0,     totalNet: 4200.00 },
    { collaboratorId: carlos.id, collaboratorName: "Carlos Quispe",       period: "2026-01", paymentCycle: "MONTHLY",
      baseSalary: 3200,   hourlyRate: 15.38, scheduledDays: 26, workedDays: 24,
      totalMinutesLate: 18,  totalLateDiscount: 2.05,  totalOvertimeMinutes: 60,  totalOvertimePay: 23.07, totalNet: 3221.02 },
    { collaboratorId: ana.id,    collaboratorName: "Ana Torres",          period: "2026-01", paymentCycle: "MONTHLY",
      baseSalary: 2800,   hourlyRate: 15.91, scheduledDays: 22, workedDays: 17,
      totalMinutesLate: 90,  totalLateDiscount: 18.56, totalOvertimeMinutes: 0,   totalOvertimePay: 0,     totalNet: 2781.44 },
    { collaboratorId: luis.id,   collaboratorName: "Luis Mendoza",        period: "2026-01", paymentCycle: "MONTHLY",
      baseSalary: 3800,   hourlyRate: 21.59, scheduledDays: 22, workedDays: 22,
      totalMinutesLate: 0,   totalLateDiscount: 0,     totalOvertimeMinutes: 195, totalOvertimePay: 89.07, totalNet: 3889.07 },
    { collaboratorId: sofia.id,  collaboratorName: "Sofía Ramos",         period: "2026-01", paymentCycle: "MONTHLY",
      baseSalary: 2600,   hourlyRate: 14.77, scheduledDays: 22, workedDays: 15,
      totalMinutesLate: 35,  totalLateDiscount: 6.15,  totalOvertimeMinutes: 0,   totalOvertimePay: 0,     totalNet: 2593.85 },
  ]

  const janSnapshot = await prisma.payrollSnapshot.create({
    data: {
      period:           "2026-01",
      paymentCycle:     "MONTHLY",
      half:             1,
      status:           SnapshotStatus.CLOSED,
      items:            janItems,
      settingsSnapshot: baseSettings,
      totalNet:         20309.41,   // items sum (20209.41) + ajustes (+100)
      createdById:      rrhh.id,
      closedById:       admin.id,
      closedAt:         new Date("2026-02-03T10:30:00.000Z"),
    },
  })

  await prisma.payrollAdjustment.createMany({
    data: [
      {
        snapshotId:     janSnapshot.id,
        collaboratorId: juan.id,
        amount:         150.00,
        description:    "Bono por captación de nuevo cliente (enero)",
        createdById:    rrhh.id,
        createdAt:      new Date("2026-02-01T09:00:00.000Z"),
      },
      {
        snapshotId:     janSnapshot.id,
        collaboratorId: ana.id,
        amount:         -50.00,
        description:    "Descuento por préstamo de equipos no devueltos",
        createdById:    rrhh.id,
        createdAt:      new Date("2026-02-01T09:15:00.000Z"),
      },
    ],
  })

  // ── 8. Snapshot BORRADOR — Febrero 2026 (MONTHLY, datos parciales) ───────
  // Datos hasta Feb 20 (15 días hábiles de 20 totales del mes)
  // hourlyRate = salary / (20 × 8) = salary / 160  (mes completo aunque sea parcial)
  //
  // Juan  : 3500/160=21.88/h | lat_net=13min→4.73  | OT=30min→16.41  | net=3511.68
  // María : 4200/160=26.25/h | perfecta              | net=4200.00
  // Carlos: 3200/200=16.00/h | lat_net=0             | net=3200.00
  // Ana   : 2800/160=17.50/h | lat_net=67min→19.54   | net=2780.46
  // Luis  : 3800/160=23.75/h | OT=60min→35.63        | net=3835.63
  // Sofía : 2600/160=16.25/h | lat_net=7min→1.90     | net=2598.10
  // Items sum = 20125.87 | Ajuste: +200 | totalNet = 20325.87

  const febItems = [
    { collaboratorId: juan.id,   collaboratorName: "Juan Pérez",          period: "2026-02", paymentCycle: "MONTHLY",
      baseSalary: 3500,   hourlyRate: 21.88, scheduledDays: 20, workedDays: 14,
      totalMinutesLate: 18,  totalLateDiscount: 4.73,  totalOvertimeMinutes: 30,  totalOvertimePay: 16.41, totalNet: 3511.68 },
    { collaboratorId: maria.id,  collaboratorName: "María López",         period: "2026-02", paymentCycle: "MONTHLY",
      baseSalary: 4200,   hourlyRate: 26.25, scheduledDays: 20, workedDays: 15,
      totalMinutesLate: 0,   totalLateDiscount: 0,     totalOvertimeMinutes: 0,   totalOvertimePay: 0,     totalNet: 4200.00 },
    { collaboratorId: carlos.id, collaboratorName: "Carlos Quispe",       period: "2026-02", paymentCycle: "MONTHLY",
      baseSalary: 3200,   hourlyRate: 16.00, scheduledDays: 25, workedDays: 19,
      totalMinutesLate: 0,   totalLateDiscount: 0,     totalOvertimeMinutes: 0,   totalOvertimePay: 0,     totalNet: 3200.00 },
    { collaboratorId: ana.id,    collaboratorName: "Ana Torres",          period: "2026-02", paymentCycle: "MONTHLY",
      baseSalary: 2800,   hourlyRate: 17.50, scheduledDays: 20, workedDays: 9,
      totalMinutesLate: 97,  totalLateDiscount: 19.54, totalOvertimeMinutes: 0,   totalOvertimePay: 0,     totalNet: 2780.46 },
    { collaboratorId: luis.id,   collaboratorName: "Luis Mendoza",        period: "2026-02", paymentCycle: "MONTHLY",
      baseSalary: 3800,   hourlyRate: 23.75, scheduledDays: 20, workedDays: 15,
      totalMinutesLate: 0,   totalLateDiscount: 0,     totalOvertimeMinutes: 60,  totalOvertimePay: 35.63, totalNet: 3835.63 },
    { collaboratorId: sofia.id,  collaboratorName: "Sofía Ramos",         period: "2026-02", paymentCycle: "MONTHLY",
      baseSalary: 2600,   hourlyRate: 16.25, scheduledDays: 20, workedDays: 7,
      totalMinutesLate: 12,  totalLateDiscount: 1.90,  totalOvertimeMinutes: 0,   totalOvertimePay: 0,     totalNet: 2598.10 },
  ]

  const febSnapshot = await prisma.payrollSnapshot.create({
    data: {
      period:           "2026-02",
      paymentCycle:     "MONTHLY",
      half:             1,
      status:           SnapshotStatus.DRAFT,
      items:            febItems,
      settingsSnapshot: baseSettings,
      totalNet:         20325.87,   // items sum (20125.87) + ajuste (+200)
      createdById:      rrhh.id,
    },
  })

  await prisma.payrollAdjustment.create({
    data: {
      snapshotId:     febSnapshot.id,
      collaboratorId: luis.id,
      amount:         200.00,
      description:    "Bono por cumplimiento de metas Q1 2026",
      createdById:    rrhh.id,
      createdAt:      new Date("2026-02-22T08:00:00.000Z"),
    },
  })

  // ── 9. Historial de cambios de horario ───────────────────────────────────
  await prisma.scheduleHistory.createMany({
    data: [
      {
        scheduleId:   generalSchedule.id,
        changedById:  admin.id,
        oldStartTime: "08:00",
        newStartTime: "08:30",
        oldDays:      ["MON","TUE","WED","THU","FRI"],
        newDays:      ["MON","TUE","WED","THU","FRI"],
        oldType:      ScheduleType.GENERAL,
        newType:      ScheduleType.GENERAL,
        reason:       "Ajuste de horario por acuerdo con planilla",
        changedAt:    new Date("2025-12-01T10:00:00.000Z"),
      },
      {
        scheduleId:   specialSchedule.id,
        changedById:  rrhh.id,
        oldStartTime: "08:30",
        newStartTime: "09:00",
        oldDays:      ["MON","TUE","WED","THU","FRI"],
        newDays:      ["MON","TUE","WED","THU","FRI","SAT"],
        oldType:      ScheduleType.SPECIAL,
        newType:      ScheduleType.SPECIAL,
        reason:       "Carlos cubre turno de campo los sábados",
        changedAt:    new Date("2025-12-15T14:30:00.000Z"),
      },
    ],
  })

  // ── 10. Auditoría ────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        actorId:    admin.id,
        actorRole:  "ADMIN",
        action:     "CREATE",
        resource:   "COLLABORATOR",
        resourceId: String(juan.id),
        status:     AuditStatus.SUCCESS,
        after:      { name: "Juan Pérez", salary: 3500 },
        createdAt:  new Date("2023-03-01T09:00:00.000Z"),
      },
      {
        actorId:    rrhh.id,
        actorRole:  "RRHH",
        action:     "UPDATE",
        resource:   "COLLABORATOR",
        resourceId: String(ana.id),
        status:     AuditStatus.SUCCESS,
        before:     { salary: 2600 },
        after:      { salary: 2800 },
        reason:     "Incremento salarial anual por desempeño",
        createdAt:  new Date("2026-01-15T11:30:00.000Z"),
      },
      {
        actorId:    rrhh.id,
        actorRole:  "RRHH",
        action:     "CREATE",
        resource:   "PAYROLL_ADJUSTMENT",
        status:     AuditStatus.SUCCESS,
        after:      { collaborator: "Juan Pérez", amount: 150, concept: "Bono captación" },
        createdAt:  new Date("2026-02-01T09:00:00.000Z"),
      },
      {
        actorId:    admin.id,
        actorRole:  "ADMIN",
        action:     "CLOSE",
        resource:   "PAYROLL_SNAPSHOT",
        resourceId: String(janSnapshot.id),
        status:     AuditStatus.SUCCESS,
        before:     { status: "DRAFT"  },
        after:      { status: "CLOSED", totalNet: 20309.41 },
        createdAt:  new Date("2026-02-03T10:30:00.000Z"),
      },
      {
        actorId:    null,
        actorRole:  null,
        action:     "ACCESS_DENIED",
        resource:   "KIOSK",
        status:     AuditStatus.DENIED,
        error:      "PIN inválido — colaborador bloqueado temporalmente",
        metadata:   { collaboratorDni: "99999999", attempts: 3 },
        createdAt:  new Date("2026-02-10T08:45:00.000Z"),
      },
    ],
  })

  // ── 11. Notificaciones ───────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        adminId:   admin.id,
        message:   "Ana Torres ha acumulado 90 min de tardanzas en enero. Revisar situación.",
        read:      false,
        createdAt: new Date("2026-01-16T08:00:00.000Z"),
      },
      {
        adminId:   rrhh.id,
        message:   "Cierre de planilla enero 2026 completado correctamente. Total neto: S/ 20,309.41",
        read:      true,
        createdAt: new Date("2026-02-03T10:35:00.000Z"),
      },
      {
        adminId:   admin.id,
        message:   "Sofía Ramos registró 7 ausencias en enero. Se recomienda evaluación.",
        read:      false,
        createdAt: new Date("2026-01-21T09:00:00.000Z"),
      },
      {
        adminId:   supervisor.id,
        message:   "Luis Mendoza: 195 min de horas extra en enero — validar aprobación.",
        read:      false,
        createdAt: new Date("2026-02-01T08:00:00.000Z"),
      },
    ],
  })

  // ── 12. Resumen ───────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════╗")
  console.log("║        SEED COMPLETADO — Empresa Demo SAC            ║")
  console.log("╠══════════════════════════════════════════════════════╣")
  console.log("║  USUARIOS                                            ║")
  console.log("║  admin@demo.com        Admin123!   (ADMIN)           ║")
  console.log("║  rrhh@demo.com         Rrhh123!    (RRHH)            ║")
  console.log("║  supervisor@demo.com   Supervisor123! (SUPERVISOR)   ║")
  console.log("║  readonly@demo.com     Readonly123!   (READ_ONLY)    ║")
  console.log("╠══════════════════════════════════════════════════════╣")
  console.log("║  COLABORADORES (6)                                   ║")
  console.log("║  Juan Pérez · María López · Carlos Quispe            ║")
  console.log("║  Ana Torres · Luis Mendoza · Sofía Ramos             ║")
  console.log("╠══════════════════════════════════════════════════════╣")
  console.log("║  MARCACIONES: Enero + Febrero 2026                   ║")
  console.log("║  SNAPSHOT CERRADO   : 2026-01  → S/ 20,309.41       ║")
  console.log("║  SNAPSHOT BORRADOR  : 2026-02  → S/ 20,325.87       ║")
  console.log("╚══════════════════════════════════════════════════════╝\n")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
