// src/hooks/useDebounce.ts
import { useEffect, useState } from "react"

/**
 * Devuelve `value` después de `delay` ms sin cambios.
 * Útil para inputs de búsqueda.
 */
export default function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)        // limpia si value cambia antes de tiempo
  }, [value, delay])

  return debounced
}
