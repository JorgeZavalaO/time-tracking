import { useMutation, useQueryClient } from "@tanstack/react-query"
import {Schedule } from "@/hooks/useCollaborators"


export function useSaveSchedule(){
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: Partial<Schedule> & {id?:number}) => {
            const url = payload.id ? `/api/schedules/${payload.id}` : "/api/schedules"
            const method = payload.id ? "PUT":"POST"
            const r = await fetch(url,{
                method,
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify(payload),
            })
            if(!r.ok) throw await r.json()
            return r.json()
        },
        onSuccess: () => qc.invalidateQueries({queryKey: ["schedules"]})
    })
}

export function useDeleteSchedule(){
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id:number) => {
            const url = `/api/schedules/${id}`
            const r = await fetch(url,{
                method:"DELETE"
            })
            if(!r.ok) throw await r.json()
            return id
        },
        onSuccess: () => qc.invalidateQueries({queryKey: ["schedules"]})
    })
}
