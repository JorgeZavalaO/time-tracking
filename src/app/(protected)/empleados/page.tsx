"use client"
import { useState } from "react"
import { CollaboratorForm } from "@/components/CollaboratorForm"
import { useCollaborators } from "@/hooks/useCollaborators"
import { Button } from "@/components/ui/button"

export default function EmpleadosPage() {
  const [page,setPage]   = useState(1)
  const [search,setSearch] = useState("")
  const { items,total,loading } = useCollaborators({ page, pageSize:10, search })

  const refresh = ()=> setPage(p=>p) // trigger refetch

  return (
    <div className="W-full flex flex-col gap-4 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Colaboradores</h1>
        <CollaboratorForm onSave={refresh} />
      </header>

      <div className="flex gap-2">
        <input
          className="border px-2 py-1 flex-1 rounded-md"
          placeholder="Buscar DNI / nombre"
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />
        <Button onClick={()=>setPage(1)}>Buscar</Button>
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
            {loading ? (
              <tr><td colSpan={5} className="p-4 text-center">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">— Sin resultados —</td></tr>
            ) : (
              items.map(col=>(
                <tr key={col.id} className="hover:bg-accent/20">
                  <td className="p-2">{col.dni}</td>
                  <td className="p-2">{col.name}</td>
                  <td className="p-2">{col.schedule.days} · {col.schedule.startTime}</td>
                  <td className="p-2 text-center">{col.active?"✅":"❌"}</td>
                  <td className="p-2 space-x-2">
                    <CollaboratorForm initialData={col} onSave={refresh}/>
                    <Button
                      variant="destructive" size="sm"
                      onClick={async()=>{
                        if(!confirm("¿Eliminar colaborador?")) return
                        const r = await fetch(`/api/collaborators/${col.id}`,{ method:"DELETE" })
                        if(r.ok) refresh(); else alert("No se pudo eliminar")
                      }}>
                      Borrar
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* paginador */}
      <footer className="flex justify-between items-center">
        <Button disabled={page===1} onClick={()=>setPage(p=>p-1)}>« Anterior</Button>
        <span>Página {page} / {Math.max(1,Math.ceil(total/10))}</span>
        <Button disabled={page*10>=total} onClick={()=>setPage(p=>p+1)}>Siguiente »</Button>
      </footer>
    </div>
  )
}
