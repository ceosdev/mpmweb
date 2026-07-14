import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  title: string
  description?: string
  /**
   * Ícone da tela — use o **mesmo do item de menu**, para o usuário reconhecer
   * onde está. Opcional: as telas que não passam nada seguem só com o título.
   */
  icon?: LucideIcon
  /** Actions rendered on the right (buttons, etc.). */
  children?: ReactNode
}

/**
 * Standard page title block — keeps spacing and typography consistent.
 */
export function PageHeader({ title, description, icon: Icon, children }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
          )}
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
