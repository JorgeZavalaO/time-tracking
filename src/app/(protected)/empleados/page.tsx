'use client'
import { useState } from 'react'
import { CollaboratorForm } from '@/components/CollaboratorForm'
import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton'
import { useCollaborators } from '@/hooks/useCollaborators'
import { useDeleteCollaborator } from '@/hooks/useCollaboratorMutations'
import useDebounce from '@/hooks/useDebounce'
import SkeletonRow from '@/components/skeleton/SkeletonRow'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BadgeCheck, Clock } from 'lucide-react'

const PAGE_SIZE = 10

export default function EmpleadosPage() {
  const [page, setPage] = useState(1)
  const [searchRaw, setSearchRaw] = useState('')
  const search = useDebounce(searchRaw, 400)

  const { data, isFetching } = useCollaborators(page, PAGE_SIZE, search)
  const items = data?.items ?? []
  const total = data?.total ?? 0

  const deleteMutation = useDeleteCollaborator(page, PAGE_SIZE, search)

  return (
    <section className="w-full flex flex-col gap-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Colaboradores</h1>
        <CollaboratorForm
          page={page}
          pageSize={PAGE_SIZE}
          search={search}
          onClose={() => {}}
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
          aria-busy={isFetching}
          aria-live="polite"
        >
          <thead>
            <tr className="bg-muted text-sm">
              <th scope="col" className="p-2 text-left">DNI</th>
              <th scope="col" className="p-2 text-left">Nombre</th>
              <th scope="col" className="p-2 text-left">Horario</th>
              <th scope="col" className="p-2 text-center">Activo</th>
              <th scope="col" className="p-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} cols={5} />
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  — Sin resultados —
                </td>
              </tr>
            ) : (
              items.map((col) => (
                <tr key={col.id} className="hover:bg-accent/20">
                  <td className="p-2">{col.dni}</td>
                  <td className="p-2">{col.name}</td>
                  <td className="p-2 flex items-center gap-2">
                    {col.schedule.type === 'SPECIAL' ? (
                      <BadgeCheck className="size-4 text-primary" />
                    ) : (
                      <Clock className="size-4 text-muted-foreground" />
                    )}
                    <span>{col.schedule.days} · {col.schedule.startTime}</span>
                  </td>
                  <td className="p-2 text-center">
                    {col.active ? (
                      <span className="text-green-600 font-medium">Sí</span>
                    ) : (
                      <span className="text-red-500 font-medium">No</span>
                    )}
                  </td>
                  <td className="p-2 text-center space-x-2">
                    <CollaboratorForm
                      initialData={col}
                      page={page}
                      pageSize={PAGE_SIZE}
                      search={search}
                      onClose={() => {}}
                    />
                    <ConfirmDeleteButton
                      itemName={`al colaborador ${col.name}`}
                      disabled={deleteMutation.isPending}
                      onConfirm={() =>
                        deleteMutation.mutate(col.id, {
                          onError: (e) => {
                            const errorMsg =
                              typeof e === 'object' && e !== null && 'error' in e
                                ? (e as { error?: string }).error
                                : undefined
                            alert(errorMsg ?? 'No se pudo eliminar')
                          },
                        })
                      }
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginador */}
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
          Página {page} de {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={page * PAGE_SIZE >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente »
        </Button>
      </footer>
    </section>
  )
}
