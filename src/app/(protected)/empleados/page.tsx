'use client'
import { useState } from 'react'
import { CollaboratorForm } from '@/components/CollaboratorForm'
import { useCollaborators } from '@/hooks/useCollaborators'
import { useDeleteCollaborator } from '@/hooks/useCollaboratorMutations'
import useDebounce from '@/hooks/useDebounce'
import SkeletonRow from '@/components/skeleton/SkeletonRow'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function EmpleadosPage() {
  const [page, setPage] = useState(1)
  const [searchRaw, setSearchRaw] = useState('')
  const search = useDebounce(searchRaw, 400)

  const { data, isPending } = useCollaborators(page, 10, search)
  const items = data?.items ?? []
  const total = data?.total ?? 0

  const deleteMutation = useDeleteCollaborator(page, 10, search)

  return (
    <section className="w-full flex flex-col gap-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Colaboradores</h1>
        <CollaboratorForm
          onClose={() => {}}
          page={page}
          pageSize={10}
          search={search}
        />
      </header>

      <div className="max-w-md">
        <Input
          placeholder="Buscar DNI / nombre"
          value={searchRaw}
          onChange={(e) => {
            setSearchRaw(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <div className="overflow-x-auto">
        <table
          className="min-w-full border-collapse"
          aria-busy={isPending}
          aria-live="polite"
        >
          <thead>
            <tr className="bg-muted text-sm">
              <th className="p-2 text-left">DNI</th>
              <th className="p-2 text-left">Nombre</th>
              <th className="p-2 text-left">Horario</th>
              <th className="p-2 text-center">Activo</th>
              <th className="p-2 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {isPending
              ? Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} cols={5} />
                ))
              : items.length === 0
              ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-4 text-center text-muted-foreground"
                  >
                    — Sin resultados —
                  </td>
                </tr>
              )
              : items.map((col) => (
                  <tr key={col.id} className="hover:bg-accent/20">
                    <td className="p-2">{col.dni}</td>
                    <td className="p-2">{col.name}</td>
                    <td className="p-2">
                      {col.schedule.days} · {col.schedule.startTime}
                    </td>
                    <td className="p-2 text-center">
                      {col.active ? '✅' : '❌'}
                    </td>
                    <td className="p-2 space-x-2 text-center">
                      <CollaboratorForm
                        initialData={col}
                        onClose={() => {}}
                        page={page}
                        pageSize={10}
                        search={search}
                      />

                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (!confirm('¿Eliminar colaborador?')) return
                          deleteMutation.mutate(col.id, {
                            onError: (e: unknown) => {
                              const errorMsg =
                                typeof e === 'object' && e !== null && 'error' in e
                                  ? (e as { error?: string }).error
                                  : undefined;
                              alert(errorMsg ?? 'No se pudo eliminar');
                            },
                          })
                        }}
                      >
                        {deleteMutation.isPending ? '…' : 'Borrar'}
                      </Button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* paginador */}
      <footer className="flex justify-between items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          « Anterior
        </Button>

        <span className="text-sm text-muted-foreground">
          Página {page} de {Math.max(1, Math.ceil(total / 10))}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={page * 10 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente »
        </Button>
      </footer>
    </section>
  )
}
