import { PrismaClient, ScheduleType } from "@prisma/client";

const prisma = new PrismaClient()

async function main() {

    // Crear horarios
    const generalSchedule = await prisma.schedule.create({
        data: {
            type: ScheduleType.GENERAL,
            days: "Mon-Fri",
            startTime: "08:30",
        },
    })

    const specialSchedule = await prisma.schedule.create({
        data: {
            type: ScheduleType.SPECIAL,
            days: "Mon-Fri",
            startTime: "09:00",
        },
    })

    // Crear colaboradores
    const collaborator1 = await prisma.collaborator.create({
        data: {
            dni: "23456789",
            name: "Juan Perez",
        },
    })

    const collaborator2 = await prisma.collaborator.create({
        data: {
            dni: "87654321",
            name: "Maria Lopez",
            scheduleSpecialId: specialSchedule.id,
        },
    })
}

main().finally(()=> prisma.$disconnect())