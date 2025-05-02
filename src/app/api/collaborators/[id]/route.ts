// Endpoints para ACTUALIZAR (PUT) y ELIMINAR (DELETE) un colaborador por su ID

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"           

// const badId = () => NextResponse.json(
//     { error:"ID inválido" },
//     { status:422 }
// )

// Utilidad pequeña para convertir string → número y validar
function toValidInt(value: string): number | null {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

// PUT ▸ Actualizar un colaborador
export async function PUT(req: NextRequest, context: { params: { id: string } }) {
  try {
    // 1. Validar el ID recibido en la URL 
    const id = toValidInt(context.params.id);
    if (id === null) {
      return NextResponse.json(
        { message: "ID inválido: debe ser un entero positivo" },
        { status: 400 }
      );
    }

    // 2. Leer y validar el cuerpo (body)
    const { name, active, scheduleSpecialId } = await req.json();

    if (!name || name.trim()==="") return NextResponse.json(
        { error:"Nombre requerido" },
        { status:400 }
    )

    if (scheduleSpecialId) {
        const exists = await prisma.schedule.findUnique({ 
            where:{ id:scheduleSpecialId } 
        })
        if (!exists) return NextResponse.json(
            { error:"Horario especial inexistente" },
            { status:400 }
        )
    }

    const updated = await prisma.collaborator.update({
        where:{ id },
        data :{
          name: name.trim(),
          active: Boolean(active),
          scheduleSpecialId: scheduleSpecialId ?? null,
        },
        include:{ scheduleSpecial:true },
      })

      return NextResponse.json(updated)

  } catch (error: unknown) {
    // 5. Manejo fino de errores 
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025" // "Record to update not found."
    ) {
      return NextResponse.json(
        { message: "Colaborador no encontrado" },
        { status: 404 }
      );
    }

    console.error("PUT /collaborators/[id] error:", error);
    return NextResponse.json(
      { message: "Error inesperado al actualizar" },
      { status: 500 }
    );
  }
}


// DELETE ▸ Eliminar un colaborador 
export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  try {
    // 1. Validar el ID 
    const id = toValidInt(context.params.id);
    if (id === null) {
      return NextResponse.json(
        { message: "ID inválido: debe ser un entero positivo" },
        { status: 400 }
      );
    }

    // 2. Eliminar el registro 
    await prisma.collaborator.delete({ where: { id } });

    // 3. Confirmar éxito 
    return NextResponse.json({ message: "Colaborador eliminado" }); // 200 OK
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025" // "Record to delete not found."
    ) {
      return NextResponse.json(
        { message: "Colaborador no encontrado" },
        { status: 404 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && 
        error.code==="P2014")  // foreign-key restriction
    return NextResponse.json({ error:"Tiene registros de asistencia; desactívelo en lugar de borrarlo." },{ status:409 })

    console.error("DELETE /collaborators/[id] error:", error);
    return NextResponse.json(
      { message: "Error inesperado al eliminar" },
      { status: 500 }
    );
  }
}
