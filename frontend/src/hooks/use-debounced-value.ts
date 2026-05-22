import { useEffect, useState } from 'react'

/**
 * Returns a debounced copy of `value` — useful for search inputs so the API
 * is not hit on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
