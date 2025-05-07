import { keepPreviousData, useQuery } from '@tanstack/react-query'

export type Schedule = {
    id: number
    type: 'GENERAL' | 'SPECIAL'
    startTime: string
    days: string
  }

export type Collaborator = {
  id: number
  dni: string
  name: string
  active: boolean
  schedule: Schedule
}

export function useCollaborators(
  page: number,
  pageSize: number,
  search: string,
) {
  return useQuery({
    queryKey: ['collaborators', page, pageSize, search],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
      })
      const r = await fetch(`/api/collaborators?${qs}`)
      if (!r.ok) throw await r.json()
      return (await r.json()) as {
        items: Collaborator[]
        total: number
      }
    },
    select: (d) => ({ ...d, items: d.items ?? [] }), // normaliza
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
