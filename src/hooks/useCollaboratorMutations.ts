import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Collaborator } from './useCollaborators'

export function useSaveCollaborator(
  page: number,
  pageSize: number,
  search: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      payload: Partial<Collaborator> & { scheduleSpecialId?: number | null },
    ) => {
      const url = payload.id
        ? `/api/collaborators/${payload.id}`
        : '/api/collaborators'
      const method = payload.id ? 'PUT' : 'POST'
      const body = {
        ...payload,
        scheduleSpecialId: payload.scheduleSpecialId ?? null,
      }
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw await r.json()
      return r.json()
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ['collaborators', page, pageSize, search],
      }),
  })
}

export function useDeleteCollaborator(
  page: number,
  pageSize: number,
  search: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/collaborators/${id}`, { method: 'DELETE' })
      if (!r.ok) throw await r.json()
      return id
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ['collaborators', page, pageSize, search],
      }),
  })
}
