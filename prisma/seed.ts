import { PrismaClient, AccessStatus, ScheduleType, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Limpieza idempotente para permitir re-ejecuciones de seed en desarrollo
  await prisma.accessEditHistory.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.scheduleHistory.deleteMany();
  await prisma.justification.deleteMany();
  await prisma.access.deleteMany();
  await prisma.collaborator.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.user.deleteMany();

  // Credenciales del administrador que se crearán
  const adminPlainPassword = "Admin123!";
  const hashed = await bcrypt.hash(adminPlainPassword, 10);

  // 1) Crear usuario administrador
  const admin = await prisma.user.create({
    data: {
      email: "admin@example.com",
      password: hashed,
      name: "Administrador Seed",
      role: Role.ADMIN,
    },
  });

  // 2) Crear schedules de ejemplo
  const generalSchedule = await prisma.schedule.create({
    data: {
      type: ScheduleType.GENERAL,
      days: ["MON", "TUE", "WED", "THU", "FRI"],
      startTime: "08:30",
    },
  });

  const specialSchedule = await prisma.schedule.create({
    data: {
      type: ScheduleType.SPECIAL,
      days: ["MON", "TUE", "WED", "THU", "FRI"],
      startTime: "09:00",
    },
  });

  // 3) Crear algunos colaboradores con accesos (accesses) y justificaciones
  const collab1 = await prisma.collaborator.create({
    data: {
      dni: "12345678",
      name: "Juan Pérez",
      active: true,
      accesses: {
        create: [
          {
            timestamp: new Date("2025-05-01T08:28:00Z"),
            status: AccessStatus.ON_TIME,
            recordedById: admin.id,
          },
          {
            timestamp: new Date("2025-05-02T08:50:00Z"),
            status: AccessStatus.LATE,
            recordedById: admin.id,
            justification: {
              create: {
                reason: "Tráfico inesperado",
                createdById: admin.id,
              },
            },
          },
        ],
      },
    },
  });

  const collab2 = await prisma.collaborator.create({
    data: {
      dni: "87654321",
      name: "María López",
      active: true,
      scheduleSpecialId: specialSchedule.id,
      accesses: {
        create: [
          {
            timestamp: new Date("2025-05-01T09:02:00Z"),
            status: AccessStatus.LATE,
            recordedById: admin.id,
            justification: {
              create: {
                reason: "Cita médica",
                createdById: admin.id,
              },
            },
          },
          {
            timestamp: new Date("2025-05-03T08:25:00Z"),
            status: AccessStatus.ON_TIME,
            recordedById: admin.id,
          },
        ],
      },
    },
  });

  // 4) Crear historial de cambios de schedule
  await prisma.scheduleHistory.create({
    data: {
      scheduleId: generalSchedule.id,
      changedById: admin.id,
      oldStartTime: "08:00",
      newStartTime: "08:30",
    },
  });

  // 5) Crear justificación independiente (ya están creadas en los accesos), y una notificación
  await prisma.notification.create({
    data: {
      adminId: admin.id,
      message: "Cuenta de administrador creada y seed de ejemplo ejecutada.",
    },
  });

  // 6) Mensaje final con credenciales (contraseña en texto plano para pruebas)
  console.log("--- SEED COMPLETADO ---");
  console.log("Admin email: admin@example.com");
  console.log("Admin password (plain for testing):", adminPlainPassword);
  console.log("Por favor, cambia la contraseña en producción.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
