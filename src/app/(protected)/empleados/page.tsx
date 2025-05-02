"use client"
import { useState } from "react"
import { CollaboratorForm } from "@/components/CollaboratorForm"
import { useCollaborators } from "@/hooks/useCollaborators"
import { Button } from "@/components/ui/button"
import useDebounce from "@/hooks/useDebounce"
import SkeletonRow from "@/components/skeleton/SkeletonRow"
import { useDeleteCollaborator } from "@/hooks/useCollaboratorMutations"
import { Input } from "@/components/ui/input"


export default function EmpleadosPage() {
  const [page,setPage]   = useState(1)
  const [search,setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 400)
  const query = useCollaborators({ page, pageSize: 10, search: debouncedSearch })
  const items = query.data?.items || []
  const total = query.data?.total || 0
  const isLoading = query.isLoading || query.isFetching
  const deleteMutation = useDeleteCollaborator()

  // Función para actualizar datos
  const refresh = () => query.refetch()

  return (
    <div className="W-full flex flex-col gap-4 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Colaboradores</h1>
        <CollaboratorForm onSave={refresh} />
      </header>

      <div className="flex gap-2 max-w-md">
        <Input
          type="text"
          placeholder="Buscar DNI / nombre"
          value={search}
          onChange={e=>{
            setSearch(e.target.value)
            setPage(1)
          }}
          className="w-full"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-muted text-sm">
              <th className="p-2 text-left">DNI</th>
              <th className="p-2 text-left">Nombre</th>
              <th className="p-2 text-left">Horario</th>
              <th className="p-2">Activo</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">— Sin resultados —</td></tr>
            ) : (
              items.map(col => (
                <tr key={col.id} className="hover:bg-accent/20">
                  <td className="p-2">{col.dni}</td>
                  <td className="p-2">{col.name}</td>
                  <td className="p-2">{col.schedule.days} · {col.schedule.startTime}</td>
                  <td className="p-2 text-center">{col.active ? "✅" : "❌"}</td>
                  <td className="p-2 space-x-2">
                    <CollaboratorForm initialData={col} onSave={refresh} />
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={async () => {
                        if (!confirm("¿Eliminar colaborador?")) return
                        deleteMutation.mutate(col.id, {
                          onSuccess: refresh,
                          onError: (err: unknown) => {
                            const errorMsg =
                              typeof err === "object" && err !== null && "error" in err
                                ? (err as { error?: string }).error
                                : undefined;
                            alert(errorMsg || "No se pudo eliminar");
                          }
                        })
                      }}>
                      {deleteMutation.isPending ? "..." : "Borrar"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* paginador */}
      <footer className="flex justify-between items-center gap-4 mt-4">
  <Button
    variant="outline"
    size="sm"
    disabled={page === 1}
    onClick={() => setPage(p => p - 1)}
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
    onClick={() => setPage(p => p + 1)}
  >
    Siguiente »
  </Button>
</footer>

    </div>
  )
}
