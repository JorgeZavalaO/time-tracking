/**
 * Helpers de exportación compartidos.
 * Provee: toXlsx() y toPdf() para generar binarios desde arrays de filas.
 */
import * as XLSX from "xlsx"
import PDFDocument from "pdfkit"

export type ExportRow = (string | number | null | undefined)[]

export type ExportSheet = {
  name: string
  headers: string[]
  rows: ExportRow[]
}

// ─── Excel ─────────────────────────────────────────────────────────────────

/**
 * Genera un Uint8Array con un workbook .xlsx.
 * @param sheets  Arreglo de hojas { name, headers, rows }
 */
export function toXlsx(sheets: ExportSheet[]): Uint8Array {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows])
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
  return new Uint8Array(buf)
}

// ─── PDF ───────────────────────────────────────────────────────────────────

/** Ajustes de presentación */
const PAGE_MARGIN   = 40
const COL_MIN_WIDTH = 60
const TABLE_FONT    = 8
const TITLE_FONT    = 14
const SUB_FONT      = 10
const ROW_HEIGHT    = 14

/**
 * Genera un Buffer con un PDF de múltiples tablas.
 * @param title       Título del documento
 * @param sheets      Arreglo de secciones { name, headers, rows }
 * @param companyName Nombre de empresa para el pie de página
 */
export async function toPdf(
  title: string,
  sheets: ExportSheet[],
  companyName = "Mi Empresa",
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      layout: "landscape",
    })

    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end",  () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    // ── Encabezado general ────────────────────────────────────────────────
    doc
      .fontSize(TITLE_FONT)
      .font("Helvetica-Bold")
      .text(title, PAGE_MARGIN, PAGE_MARGIN, { align: "center" })

    doc
      .fontSize(SUB_FONT)
      .font("Helvetica")
      .text(
        `${companyName}  ·  Generado el ${new Date().toLocaleDateString("es-PE", { dateStyle: "long" })}`,
        PAGE_MARGIN,
        PAGE_MARGIN + 18,
        { align: "center" },
      )

    let cursorY = PAGE_MARGIN + 44

    // ── Secciones / tablas ────────────────────────────────────────────────
    for (const sheet of sheets) {
      // Título de sección
      doc
        .fontSize(SUB_FONT)
        .font("Helvetica-Bold")
        .text(sheet.name, PAGE_MARGIN, cursorY)
      cursorY += 16

      if (sheet.rows.length === 0) {
        doc
          .fontSize(TABLE_FONT)
          .font("Helvetica")
          .text("Sin datos", PAGE_MARGIN + 4, cursorY)
        cursorY += ROW_HEIGHT + 4
        continue
      }

      // Calcular anchos de columna proporcionales
      const pageWidth = doc.page.width - PAGE_MARGIN * 2
      const colCount  = sheet.headers.length
      const colWidth  = Math.max(COL_MIN_WIDTH, Math.floor(pageWidth / colCount))

      // Cabecera de tabla
      doc.font("Helvetica-Bold").fontSize(TABLE_FONT)
      sheet.headers.forEach((h, i) => {
        doc.text(
          String(h),
          PAGE_MARGIN + i * colWidth,
          cursorY,
          { width: colWidth - 4, lineBreak: false },
        )
      })

      // Línea separadora
      cursorY += ROW_HEIGHT
      doc
        .moveTo(PAGE_MARGIN, cursorY - 2)
        .lineTo(PAGE_MARGIN + colCount * colWidth, cursorY - 2)
        .strokeColor("#aaaaaa")
        .lineWidth(0.5)
        .stroke()

      // Filas
      doc.font("Helvetica").fontSize(TABLE_FONT)
      for (const row of sheet.rows) {
        // Salto de página si es necesario
        if (cursorY + ROW_HEIGHT > doc.page.height - PAGE_MARGIN - 20) {
          doc.addPage()
          cursorY = PAGE_MARGIN
        }

        row.forEach((cell, i) => {
          doc.text(
            cell == null ? "—" : String(cell),
            PAGE_MARGIN + i * colWidth,
            cursorY,
            { width: colWidth - 4, lineBreak: false },
          )
        })
        cursorY += ROW_HEIGHT
      }

      cursorY += 20 // espacio entre secciones

      // Nueva página si no cabe la siguiente sección
      if (cursorY > doc.page.height - PAGE_MARGIN - 50) {
        doc.addPage()
        cursorY = PAGE_MARGIN
      }
    }

    doc.end()
  })
}
