import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Time-Tracking App",
  description: "Control de ingreso a almacén",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
