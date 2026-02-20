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
      {/* suppressHydrationWarning: avoids hydration mismatch errors caused by
          browser extensions that mutate the DOM (e.g. adding attributes like
          cz-shortcut-listen). Safe to enable on body so React won't warn when
          client HTML differs from server-rendered HTML. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
