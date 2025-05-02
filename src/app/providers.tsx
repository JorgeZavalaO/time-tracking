// src/app/providers.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from '@/components/ui/sonner'
import { useState } from 'react'

export default function Providers({ children }: { children: React.ReactNode }) {
  // ⚠️ Se crea una sola instancia; useState evita recrearla en cada render
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}

      {/* notificaciones */}
      <Toaster />

      {/* Devtools opcional (solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
