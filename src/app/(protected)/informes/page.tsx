import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'

function formatDateShort(d: Date) {
  return d.toLocaleDateString()
}

export default async function InformesPage() {
  const total = await prisma.access.count()
  const onTime = await prisma.access.count({ where: { status: 'ON_TIME' } })
  const late = await prisma.access.count({ where: { status: 'LATE' } })

  // últimos 7 días
  const since = new Date()
  since.setDate(since.getDate() - 6)
  since.setHours(0, 0, 0, 0)

  const recent = await prisma.access.findMany({
    where: { timestamp: { gte: since } },
    select: { timestamp: true },
    orderBy: { timestamp: 'asc' },
  })

  const byDay: Record<string, number> = {}
  for (let i = 0; i < 7; i++) {
    const d = new Date(since)
    d.setDate(since.getDate() + i)
    byDay[formatDateShort(d)] = 0
  }

  for (const r of recent) {
    const key = formatDateShort(new Date(r.timestamp))
    byDay[key] = (byDay[key] ?? 0) + 1
  }

  return (
    <section className='space-y-6'>
      <h1 className='text-2xl font-semibold'>Informes</h1>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card>
          <CardHeader>
            <CardTitle>Total de registros</CardTitle>
            <CardDescription />
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-semibold'>{total}</div>
            <div className='text-sm text-muted-foreground mt-2'>Totales acumulados</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>On time / Tarde</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex items-center gap-4'>
              <div>
                <div className='text-2xl font-semibold'>{onTime}</div>
                <div className='text-sm text-muted-foreground'>On time</div>
              </div>
              <div>
                <div className='text-2xl font-semibold'>{late}</div>
                <div className='text-sm text-muted-foreground'>Tarde</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimos 7 días</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {Object.entries(byDay).map(([day, count]) => (
                <div key={day} className='flex justify-between text-sm'>
                  <span>{day}</span>
                  <span className='font-medium'>{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
