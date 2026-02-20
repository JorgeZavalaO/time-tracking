import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default async function RegistrosPage() {
  const accesses = await prisma.access.findMany({
    take: 50,
    orderBy: { timestamp: 'desc' },
    include: { collaborator: true },
  })

  return (
    <section className='space-y-6'>
      <h1 className='text-2xl font-semibold'>Registros</h1>

      <Card>
        <CardHeader>
          <CardTitle>Últimos registros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto rounded-md border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='p-3 text-left'>Fecha</th>
                  <th className='p-3 text-left'>Colaborador</th>
                  <th className='p-3 text-left'>DNI</th>
                  <th className='p-3 text-left'>Estado</th>
                  <th className='p-3 text-left'>Foto</th>
                </tr>
              </thead>
              <tbody>
                {accesses.map(a => (
                  <tr key={a.id} className='odd:bg-background/50 hover:bg-accent/5'>
                    <td className='p-3'>
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td className='p-3'>{a.collaborator?.name ?? '—'}</td>
                    <td className='p-3'>{a.collaborator?.dni ?? '—'}</td>
                    <td className='p-3'>{a.status}</td>
                    <td className='p-3'>
                      {a.photo_url ? (
                        <img src={a.photo_url} alt='selfie' className='h-10 w-10 rounded-full object-cover' />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
