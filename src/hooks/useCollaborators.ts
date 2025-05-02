import { keepPreviousData, useQuery } from "@tanstack/react-query";

export type Schedule = { 
    id: number; 
    startTime: string; 
    days: string 
}

export type Collaborator = {
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
    return useQuery({
        queryKey: ["collaborators", params.page, params.pageSize, params.search],
        queryFn: async() => {
            const qs = new URLSearchParams({
                page: params.page.toString(),
                pageSize: params.pageSize.toString(),
                search: params.search,
            })
            const r = await fetch(`/api/collaborators?${qs}`);
            if(!r.ok) throw new Error("Network");
            return r.json() as Promise<{ items: Collaborator[]; total: number }>;
        },
        placeholderData: keepPreviousData,    
        staleTime: 30_000,                    
    });
}