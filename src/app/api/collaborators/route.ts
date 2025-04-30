// LISTADO con paginación y búsqueda + CREAR un colaborador
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

function err(message: string, status = 400) {
    return NextResponse.json(
        { error: message },
        { status }
    )
  }

export async function GET(req: NextRequest) {
    try {
        const url = req.nextUrl
        const page = parseInt(url.searchParams.get("page") || "1", 10)
        const pageSize = parseInt(url.searchParams.get("pageSize") || "10", 10)
        const search = url.searchParams.get("search") || ""

        // Construir filtro DNI o nombre
        const where = search
        ? {
            OR: [
            { dni: { contains: search } },
            { name: { contains: search } },
            ],
        }
        : {}

        // horario general para fallback
        const generalSchedule = await prisma.schedule.findFirst({
            where: { type: "GENERAL" },
            select: { id:true, startTime:true, days:true },
        })

        // Validar paginación
        const [total, list] = await Promise.all([
            // total para paginacion
            prisma.collaborator.count({ where }),
            //  items para paginacion 
            prisma.collaborator.findMany({
                where,
                skip: (page - 1)*pageSize,
                take: pageSize,
                orderBy: {name: "asc"},
                include: { scheduleSpecial: { select:{ id:true, startTime:true, days:true } } },
            }),
        ]);

        const items = list.map(c => ({
            id:      c.id,
            dni:     c.dni,
            name:    c.name,
            active:  c.active,
            schedule: c.scheduleSpecial ?? generalSchedule!
          }))

        return NextResponse.json({ items, total });
         
    } catch (error) {
        console.error("Error in GET /collaborators:", error);
        return err("Error interno", 500)
    }
}

export async function POST(req: NextRequest) {
    const {dni, name, scheduleSpecialId} = await req.json();

    // Validaciones básicas
    if (!/^\d{8}$/.test(dni)) {
        return err("DNI inválido")
    }
    if (!name || name.trim() === "") {
        return err("Nombre requerido")
    }
    if (scheduleSpecialId) {
        const exists = await prisma.schedule.findUnique({ 
            where:
            { id:scheduleSpecialId } 
        })
        if (!exists) {
            return err("Horario especial inexistente")
        }
    }


    try {
        const created = await prisma.collaborator.create({
            data: { dni, name: name.trim(), scheduleSpecialId: scheduleSpecialId ?? null },
            include:{ scheduleSpecial:true },
          })
          return NextResponse.json(created, { status:201 })
    } catch (error: unknown) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ){
            return NextResponse.json(
                { message: "El DNI ya está registrado"},
                { status: 409 }
            );
        } 
        
        console.error("Error in POST /collaborators:", error);
        return NextResponse.json(
            { message: "Error al crear el colaborador" },
            { status: 500 }
        );
    }
}