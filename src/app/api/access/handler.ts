import { NextRequest, NextResponse } from "next/server"
import dayjs from "dayjs"
import { prisma } from "@/lib/prisma"



export default async function handler(req: NextRequest) {
    if (req.method !=="POST") return NextResponse.json({}, {status:405})
    const {dni} = await req.json()

    // 1. Validación básica
    if(!/^\d{8}$/.test(dni.trim())) {
        return NextResponse.json(
            {message:"DNI inválido"},
            {status: 400}
        )
    }

    // 2. Buscar colaborador
    const collaborator = await prisma.collaborator.findUnique({
        where:      {dni},
        include:    {scheduleSpecial:true},
    })
    if(!collaborator) 
        return NextResponse.json(
            {message:   "Colaborador no encontrado"},
            {status:    404}
        )
    
    // 3. Verificar si ya registro su entrada para evitar duplicados
    const startDay = dayjs().startOf("day").toDate()
    const endDay = dayjs().endOf("day").toDate()

    const existing = await prisma.access.findFirst({
        where: {
            collaboratorId: collaborator.id,
            timestamp: {
                gte: startDay,
                lte: endDay
            },
        },
    })
    if(existing)
        return NextResponse.json(
            {message: "Ya registraste tu entrada"},
            {status: 409}
        )
    
    // 4 Obtener horario de entrada    
    // 4.1 Verifica si existe un horario epecial para el colaborador
    const schedule = 
        collaborator.scheduleSpecial ||
        (await prisma.schedule.findFirst({
            where: {type: "GENERAL"},
        }))
    
    if(!schedule)
        return NextResponse.json(
            {message: "Horario aun no configurado"},
            {status: 500}
        )
    // 4.2 guarda la hora de entrada para su posterior comparacion
    const [h,m] = schedule.startTime.split(":").map(Number)
    const cutoff = dayjs().hour(h).minute(m).second(0)

    // 5. Calcula si el colaborador llego tarde o no
    const now = dayjs()
    const status = now.isAfter(cutoff) ? "LATE" : "ON_TIME"

    // 6. Guarda el registro
    const access = await prisma.access.create({
        data: {
            collaboratorId: collaborator.id,
            status,
        },
    })

    // respuesta de la API
    return NextResponse.json(
        {status, timeStamp: access.timestamp},
        {status: 200}
    )
}
