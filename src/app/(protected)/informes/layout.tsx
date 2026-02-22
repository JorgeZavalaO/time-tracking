"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/informes/asistencia",  label: "Asistencia"  },
  { href: "/informes/tardanzas",   label: "Tardanzas"   },
  { href: "/informes/horas-extra", label: "Horas extra" },
  { href: "/informes/incidencias", label: "Incidencias" },
]

export default function InformesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Informes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reportes de asistencia, tardanzas, horas extra e incidencias.
        </p>
      </div>

      {/* Sub-nav */}
      <nav className="flex gap-1 border-b pb-0">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {children}
    </section>
  )
}
