import { useEffect, useState } from "react"

export type Schedule = { id:number; startTime:string; days:string }

type Collaborator = {
    id: number
    dni: string
    name: string
    active: boolean
    schedule: Schedule
}

export function useCollaborators(params: {
    page: number
    pageSize: number
    search: string
}) {
    const [data, setData] = useState<{ items: Collaborator[]; total: number }>({
        items: [],
        total: 0,
    })
    const [loading, setLoading] = useState(false)
    
    useEffect(()=>{
        const ctrl = new AbortController()
        setLoading(true)
        const qs = new URLSearchParams({
            page: params.page.toString(),
            pageSize: params.pageSize.toString(),
            search: params.search,
        })
        fetch(`/api/collaborators?${qs}`,{ signal:ctrl.signal })
            .then(r=>r.json())
            .then(setData)
            .catch((e)=>{ if(e.name!=="AbortError") console.error(e) })
            .finally(()=> setLoading(false))
        return () => ctrl.abort()
    }, [params.page, params.pageSize, params.search])
    
    return {...data, loading}
}
