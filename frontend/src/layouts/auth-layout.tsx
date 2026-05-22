import { Outlet } from 'react-router-dom'
import { Boxes } from 'lucide-react'

/**
 * Layout for the public authentication screens — a centered card on a quiet
 * background.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Boxes className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">MPM Web</span>
      </div>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
      <p className="text-xs text-muted-foreground">Plataforma corporativa multiempresa</p>
    </div>
  )
}
