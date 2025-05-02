import "./globals.css"
import type { Metadata } from "next"
//import { Toaster } from "@/components/ui/sonner"
import Providers from "@/app/providers"

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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
