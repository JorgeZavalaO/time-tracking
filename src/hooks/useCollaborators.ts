import { keepPreviousData, useQuery } from '@tanstack/react-query'

export type Schedule = {
    id: number
    type: 'GENERAL' | 'SPECIAL'
    startTime: string
    endTime?: string | null
    days: string
  }

export type Collaborator = {
  id: number
  dni: string
  name: string
  active: boolean
  isBlocked?: boolean
  hasPin?: boolean
  hasQr?: boolean
  photoUrl?: string | null
  position?: string | null
  hireDate?: string | null
  salary?: number | null
  paymentType?: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY' | null
  tags?: string[]
  schedule: Schedule
}

export function useCollaborators(
  page: number,
  pageSize: number,
  search: string,
  tag?: string,
) {
  return useQuery({
    queryKey: ['collaborators', page, pageSize, search, tag ?? ''],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
      })
      if (tag) qs.set('tag', tag)
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
