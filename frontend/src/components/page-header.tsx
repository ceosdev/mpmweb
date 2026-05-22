import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  /** Actions rendered on the right (buttons, etc.). */
  children?: ReactNode
}

/**
 * Standard page title block — keeps spacing and typography consistent.
 */
export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
