import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"

const REPORTS = [
  {
    href:        "/informes/asistencia",
    title:       "Asistencia",
    description: "Días trabajados vs. programados, porcentaje de asistencia por colaborador.",
    icon:        "✅",
  },
  {
    href:        "/informes/tardanzas",
    title:       "Tardanzas",
    description: "Ranking de colaboradores con más minutos acumulados de tardanza.",
    icon:        "⏰",
  },
  {
    href:        "/informes/horas-extra",
    title:       "Horas extra",
    description: "Total de horas extra y monto a pagar por período de planilla.",
    icon:        "⚡",
  },
  {
    href:        "/informes/incidencias",
    title:       "Incidencias",
    description: "Faltas, entradas sin salida y otras incidencias por colaborador.",
    icon:        "⚠️",
  },
]

export default function InformesPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
      {REPORTS.map(({ href, title, description, icon }) => (
        <Link key={href} href={href}>
          <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span>{icon}</span>
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-primary font-medium">Ver informe →</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
