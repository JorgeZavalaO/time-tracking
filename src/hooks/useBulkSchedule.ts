import { useMutation, useQueryClient } from '@tanstack/react-query'

type BulkSchedulePayload = {
  tag: string
  scheduleSpecialId: number | null
}

export function useBulkScheduleByTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: BulkSchedulePayload) => {
      const r = await fetch('/api/collaborators/bulk-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw await r.json()
      return r.json() as Promise<{ count: number }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] })
    },
  })
}
