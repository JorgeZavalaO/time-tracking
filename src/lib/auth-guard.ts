/**
 * auth-guard.ts
 * Guard centralizado de autenticación y autorización para API Routes.
 *
 * Uso básico:
 *   const result = await requireRole(Role.ADMIN, Role.RRHH)
 *   if (!result.ok) return result.response
 *   const { userId, role } = result
 */

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"

// --------------------------------------------------------------------------
// Tipos
// --------------------------------------------------------------------------

export type AuthSuccess = {
  ok: true
  userId: number
  role: Role
}

export type AuthFailure = {
  ok: false
  response: NextResponse
}

export type AuthResult = AuthSuccess | AuthFailure

// --------------------------------------------------------------------------
// Helpers internos
// --------------------------------------------------------------------------

function unauthorized(message = "No autorizado"): AuthFailure {
  return {
    ok: false,
    response: NextResponse.json({ error: message, code: "UNAUTHORIZED" }, { status: 401 }),
  }
}

function forbidden(message = "Acceso denegado"): AuthFailure {
  return {
    ok: false,
    response: NextResponse.json({ error: message, code: "FORBIDDEN" }, { status: 403 }),
  }
}

// --------------------------------------------------------------------------
// requireAuth: solo verifica que exista sesión válida
// --------------------------------------------------------------------------
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
    select: { id: true, role: true },
  })

  if (!user) return unauthorized()

  return { ok: true, userId: user.id, role: user.role }
}

// --------------------------------------------------------------------------
// requireRole: verifica sesión y que el rol esté en la lista permitida.
// Si no se pasan roles, actúa igual que requireAuth().
// --------------------------------------------------------------------------
export async function requireRole(...roles: Role[]): Promise<AuthResult> {
  const result = await requireAuth()
  if (!result.ok) return result

  if (roles.length > 0 && !roles.includes(result.role)) {
    return forbidden()
  }

  return result
}

// --------------------------------------------------------------------------
// Helpers de conveniencia para cada rol
// --------------------------------------------------------------------------
export const requireAdmin     = () => requireRole(Role.ADMIN)
export const requireAdminOrHR = () => requireRole(Role.ADMIN, Role.RRHH)
export const requireAtLeastSupervisor = () =>
  requireRole(Role.ADMIN, Role.RRHH, Role.SUPERVISOR)

// --------------------------------------------------------------------------
// Matriz de permisos por operación (extensible)
// --------------------------------------------------------------------------
export const Permissions = {
  // Colaboradores
  COLLABORATOR_READ:   [Role.ADMIN, Role.RRHH, Role.SUPERVISOR, Role.READ_ONLY] as Role[],
  COLLABORATOR_WRITE:  [Role.ADMIN, Role.RRHH] as Role[],
  COLLABORATOR_DELETE: [Role.ADMIN] as Role[],

  // Horarios
  SCHEDULE_READ:   [Role.ADMIN, Role.RRHH, Role.SUPERVISOR, Role.READ_ONLY] as Role[],
  SCHEDULE_WRITE:  [Role.ADMIN, Role.RRHH] as Role[],
  SCHEDULE_DELETE: [Role.ADMIN] as Role[],

  // QR / credenciales
  CREDENTIAL_WRITE: [Role.ADMIN, Role.RRHH] as Role[],

  // Auditoría / registros
  AUDIT_READ: [Role.ADMIN, Role.RRHH] as Role[],

  // Configuración de empresa
  SETTINGS_WRITE: [Role.ADMIN] as Role[],
} as const
