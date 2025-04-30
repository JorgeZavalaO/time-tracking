"use client"
import { useState, useEffect } from "react"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetTrigger, SheetFooter, SheetClose
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useSchedules } from "@/hooks/useSchedules"
import { Schedule } from "@/hooks/useCollaborators"

export function CollaboratorForm({
  onSave,
  initialData,
}: {
  onSave: () => void
  initialData?: {
    id:number; dni:string; name:string; active:boolean;
    schedule: Schedule
  }
}) {
  const schedules = useSchedules("SPECIAL")
  const [open,setOpen] = useState(false)
  const [dni,setDni]   = useState("")
  const [name,setName] = useState("")
  const [active,setActive] = useState(true)
  const [scheduleId,setScheduleId] = useState<number|0>(0)
  const [loading,setLoading] = useState(false)

  useEffect(()=>{
    if(open){
      setDni(initialData?.dni || "")
      setName(initialData?.name || "")
      setActive(initialData?.active ?? true)
      setScheduleId(initialData?.schedule?.id ?? 0)
    }
  },[open,initialData])

  async function handleSubmit(e:React.FormEvent){
    e.preventDefault()
    setLoading(true)
    const method = initialData ? "PUT":"POST"
    const url = initialData ? `/api/collaborators/${initialData.id}` : "/api/collaborators"

    const res = await fetch(url,{
      method,
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        dni,
        name,
        active,
        scheduleSpecialId: scheduleId || null,
      }),
    })
    setLoading(false)
    if(!res.ok){
      toast.error((await res.json()).error ?? "Error")
      return
    }
    toast.success("Guardado")
    setOpen(false)
    onSave()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={initialData?"outline":"default"}>
          {initialData?"Editar":"Nuevo colaborador"}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px]">
        <SheetHeader><SheetTitle>{initialData?"Editar":"Nuevo"} colaborador</SheetTitle></SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <Label htmlFor="dni">DNI</Label>
            <Input id="dni" value={dni} maxLength={8}
              onChange={e=>setDni(e.target.value.replace(/\D/g,""))} required />
          </div>
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={e=>setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="schedule">Horario especial</Label>
            <select
              id="schedule"
              className="border rounded-md px-2 py-1 w-full"
              value={scheduleId}
              onChange={e=>setScheduleId(Number(e.target.value))}
            >
              <option value={0}>— Usa horario general —</option>
              {schedules.map(s=>(
                <option key={s.id} value={s.id}>
                  {s.days} · {s.startTime}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={active} onChange={e=>setActive(e.target.checked)} />
            <Label htmlFor="active">Activo</Label>
          </div>
          <SheetFooter className="flex justify-end gap-2">
            <SheetClose asChild><Button variant="outline">Cancelar</Button></SheetClose>
            <Button type="submit" disabled={loading}>{loading?"Guardando…":"Guardar"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
