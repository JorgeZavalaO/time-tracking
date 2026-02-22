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
import { BadgeCheck, Clock, Tag, X } from 'lucide-react'

const PAGE_SIZE = 10

export default function EmpleadosPage() {
  const [page, setPage] = useState(1)
  const [searchRaw, setSearchRaw] = useState('')
  const [tagFilterRaw, setTagFilterRaw] = useState('')
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined)
  const search = useDebounce(searchRaw, 400)

  const { data, isFetching } = useCollaborators(page, PAGE_SIZE, search, tagFilter)
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

      <div className="flex flex-wrap gap-3 items-start">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <Input
            placeholder="Buscar DNI / nombre"
            value={searchRaw}
            onChange={(e) => {
              setSearchRaw(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <form
          className="flex gap-2 items-center"
          onSubmit={(e) => {
            e.preventDefault()
            setTagFilter(tagFilterRaw.trim() || undefined)
            setPage(1)
          }}
        >
          <div className="relative flex items-center">
            <Tag className="absolute left-2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-7 w-44"
              placeholder="Filtrar etiqueta"
              value={tagFilterRaw}
              onChange={(e) => setTagFilterRaw(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" size="sm">Filtrar</Button>
          {tagFilter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setTagFilter(undefined); setTagFilterRaw(''); setPage(1) }}
            >
              <X className="size-4" />
            </Button>
          )}
        </form>
        {tagFilter && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Tag className="size-3" /> {tagFilter}
          </span>
        )}
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
              <th scope="col" className="p-2 text-left">Etiquetas</th>
              <th scope="col" className="p-2 text-left">Seguridad</th>
              <th scope="col" className="p-2 text-center">Activo</th>
              <th scope="col" className="p-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} cols={6} />
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
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
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {(col.tags ?? []).map((t) => (
                        <button
                          key={t}
                          type="button"
                          title={`Filtrar por "${t}"`}
                          onClick={() => { setTagFilter(t); setTagFilterRaw(t); setPage(1) }}
                          className="rounded-full bg-secondary px-2 py-0.5 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      <span className={`rounded px-2 py-0.5 text-xs ${col.hasPin ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {col.hasPin ? 'PIN OK' : 'Sin PIN'}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs ${col.hasQr ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {col.hasQr ? 'QR OK' : 'Sin QR'}
                      </span>
                      {col.isBlocked ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          Bloqueado
                        </span>
                      ) : null}
                    </div>
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
