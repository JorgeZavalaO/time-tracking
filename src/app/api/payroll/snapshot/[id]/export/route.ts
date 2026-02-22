/**
 * GET /api/payroll/snapshot/[id]/export?format=xlsx|pdf
 * Genera un export del snapshot (Resumen + Ajustes).
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, Permissions } from "@/lib/auth-guard"
import { toXlsx, toPdf } from "@/lib/export"
import type { ExportSheet } from "@/lib/export"

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export async function GET(req: NextRequest, ctx: unknown) {
  const { params } = ctx as { params: { id: string } }
  const auth = await requireRole(...Permissions.COLLABORATOR_WRITE)
  if (!auth.ok) return auth.response

  const id = Number(params.id)
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const format = (searchParams.get("format") ?? "xlsx") as "xlsx" | "pdf"

  const snapshot = await prisma.payrollSnapshot.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      closedBy:  { select: { name: true } },
      adjustments: {
        include: {
          collaborator: { select: { name: true } },
          createdBy:    { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!snapshot) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const settings = (await prisma.companySettings.findFirst()) ?? undefined
  const companyName = settings?.companyName ?? "Empresa"

  // ── Items from snapshot.items JSON ──────────────────────────────────
  // Campos corresponden exactamente a PayrollSummary (sin byDay)
  const items = snapshot.items as Array<{
    collaboratorId:       number
    collaboratorName:     string
    baseSalary:           number
    hourlyRate:           number
    scheduledDays:        number
    workedDays:           number
    totalMinutesLate:     number
    totalLateDiscount:    number
    totalOvertimeMinutes: number
    totalOvertimePay:     number
    totalNet:             number
  }>

  // Calcular ajuste por colaborador
  const adjByCollaborator = new Map<number, number>()
  for (const adj of snapshot.adjustments) {
    const prev = adjByCollaborator.get(adj.collaboratorId) ?? 0
    adjByCollaborator.set(adj.collaboratorId, prev + Number(adj.amount))
  }

  // ── Sheet 1: Resumen ───────────────────────────────────────────────
  const summarySheet: ExportSheet = {
    name: "Resumen",
    headers: [
      "Colaborador", "Días prog.", "Días trab.",
      "Sal. base (S/)", "Tardanzas (S/)", "H.E. (S/)",
      "Neto base (S/)", "Ajuste (S/)", "Neto final (S/)",
    ],
    rows: items.map((it) => {
      const adj = adjByCollaborator.get(it.collaboratorId) ?? 0
      return [
        it.collaboratorName,
        it.scheduledDays,
        it.workedDays,
        fmtMoney(it.baseSalary),
        fmtMoney(it.totalLateDiscount),
        fmtMoney(it.totalOvertimePay),
        fmtMoney(it.totalNet),
        fmtMoney(adj),
        fmtMoney(it.totalNet + adj),
      ]
    }),
  }

  // ── Sheet 2: Ajustes ──────────────────────────────────────────────
  const adjustmentsSheet: ExportSheet = {
    name: "Ajustes",
    headers: ["Colaborador", "Monto", "Descripción", "Registrado por", "Fecha"],
    rows: snapshot.adjustments.map((adj) => [
      adj.collaborator.name,
      fmtMoney(Number(adj.amount)),
      adj.description,
      adj.createdBy.name ?? "",
      new Date(adj.createdAt).toLocaleDateString("es-PE"),
    ]),
  }

  const period         = snapshot.period  // e.g. "2026-02"
  const statusLabel    = snapshot.status === "CLOSED" ? "CERRADO" : "BORRADOR"
  const filename       = `planilla-${period}-${snapshot.paymentCycle.toLowerCase()}-${statusLabel.toLowerCase()}`
  const titleForExport = `Planilla ${period} — ${snapshot.paymentCycle} — ${statusLabel}`

  if (format === "pdf") {
    const buffer = await toPdf(titleForExport, [summarySheet, adjustmentsSheet], companyName)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    })
  }

  const buffer = toXlsx([summarySheet, adjustmentsSheet])
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  })
}
