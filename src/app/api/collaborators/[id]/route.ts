// Endpoints para ACTUALIZAR (PUT) y ELIMINAR (DELETE) un colaborador por su ID

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"
import { Prisma, AuditStatus } from "@prisma/client"
import { hash } from "bcryptjs";
import { z } from "zod";
import { requireRole, Permissions } from "@/lib/auth-guard"
import { logAudit } from "@/lib/audit"

// Utilidad pequeña para convertir string → número y validar
function toValidInt(value: string): number | null {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

const putSchema = z.object({
  name: z.string().min(1, "Nombre requerido").transform((v) => v.trim()),
  active: z.boolean().optional(),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  scheduleSpecialId: z.number().int().positive().nullable().optional(),
  // RRHH (Sprint 3)
  position: z.string().max(100).nullable().optional(),
  hireDate: z.string().datetime().nullable().optional(),
  salary: z.number().positive().nullable().optional(),
  paymentType: z.enum(["MONTHLY", "BIWEEKLY", "WEEKLY"]).nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
})

// @ts-expect-error Next.js App Router context type
// PUT ▸ Actualizar un colaborador
export async function PUT(req: NextRequest, context) {
  try {
    const authResult = await requireRole(...Permissions.COLLABORATOR_WRITE)
    if (!authResult.ok) return authResult.response

    const id = toValidInt(context.params.id);
    if (id === null) {
      return NextResponse.json(
        { error: "ID inválido: debe ser un entero positivo", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    const { name, active, scheduleSpecialId, pin, position, hireDate, salary, paymentType, tags } = putSchema.parse(await req.json());

    if (scheduleSpecialId) {
        const exists = await prisma.schedule.findUnique({ where:{ id:scheduleSpecialId } })
        if (!exists) return NextResponse.json(
            { error:"Horario especial inexistente", code: "SCHEDULE_NOT_FOUND" },
            { status:400 }
        )
    }

    // Snapshot before para auditoría
    const before = await prisma.collaborator.findUnique({
      where: { id },
      select: { name: true, active: true, scheduleSpecialId: true },
    })

    const updated = await prisma.collaborator.update({
        where:{ id },
        data:{
          name,
          active: active ?? undefined,
          is_active: active ?? undefined,
          pin_hash: pin ? await hash(pin, 10) : undefined,
          scheduleSpecialId: scheduleSpecialId ?? null,
          position: position !== undefined ? position : undefined,
          hireDate: hireDate !== undefined ? (hireDate ? new Date(hireDate) : null) : undefined,
          salary: salary !== undefined ? salary : undefined,
          paymentType: paymentType !== undefined ? paymentType : undefined,
          tags: tags !== undefined ? tags : undefined,
        },
        include:{ scheduleSpecial:true },
      })

    await logAudit({
      actorId: authResult.userId,
      actorRole: authResult.role,
      action: pin ? "PIN_CHANGE" : "UPDATE",
      resource: "COLLABORATOR",
      resourceId: id,
      status: AuditStatus.SUCCESS,
      before,
      after: { name: updated.name, active: updated.active, scheduleSpecialId: updated.scheduleSpecialId },
    })

    return NextResponse.json(updated)

  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Colaborador no encontrado", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    console.error("PUT /collaborators/[id] error:", error);
    return NextResponse.json(
      { error: "Error inesperado al actualizar", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// @ts-expect-error Next.js App Router context type
// DELETE ▸ Eliminar un colaborador
export async function DELETE(req: NextRequest, context) {
  try {
    const authResult = await requireRole(...Permissions.COLLABORATOR_DELETE)
    if (!authResult.ok) return authResult.response

    const id = toValidInt(context.params.id);
    if (id === null) {
      return NextResponse.json(
        { error: "ID inválido: debe ser un entero positivo", code: "INVALID_ID" },
        { status: 400 }
      );
    }

    // Snapshot before para auditoría
    const before = await prisma.collaborator.findUnique({
      where: { id },
      select: { dni: true, name: true, active: true },
    })

    await prisma.collaborator.delete({ where: { id } });

    await logAudit({
      actorId: authResult.userId,
      actorRole: authResult.role,
      action: "DELETE",
      resource: "COLLABORATOR",
      resourceId: id,
      status: AuditStatus.SUCCESS,
      before,
    })

    return NextResponse.json({ message: "Colaborador eliminado" });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Colaborador no encontrado", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2014")
      return NextResponse.json(
        { error: "Tiene registros de asistencia; desactívelo en lugar de borrarlo.", code: "HAS_ACCESSES" },
        { status: 409 }
      )

    console.error("DELETE /collaborators/[id] error:", error);
    return NextResponse.json(
      { error: "Error inesperado al eliminar", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
