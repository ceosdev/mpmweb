import { Loader2 } from 'lucide-react'

/**
 * Centered spinner used while the session is being restored or a route guard
 * is resolving.
 */
export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
