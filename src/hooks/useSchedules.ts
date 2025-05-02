import { useQuery } from '@tanstack/react-query'
import { Schedule } from './useCollaborators'

export function useSchedules(type: 'SPECIAL' | 'GENERAL' | null = 'SPECIAL') {
  return useQuery({
    queryKey: ['schedules', type],
    queryFn: async () => {
      const r = await fetch(`/api/schedules${type ? `?type=${type}` : ''}`)
      if (!r.ok) throw await r.json()
      return r.json() as Promise<Schedule[]>
    },
    staleTime: 5 * 60_000,
  })
}
