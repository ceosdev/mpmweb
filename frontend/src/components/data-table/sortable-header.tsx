import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type SortOrder = 'asc' | 'desc'
export interface SortState {
  column: string
  order: SortOrder
}

interface SortableHeaderProps {
  column: string
  sort: SortState | null
  onSort: (column: string) => void
  className?: string
  children: React.ReactNode
}

/**
 * Clickable table header that drives backend-side sorting. Cycles
 * `asc → desc → none` and signals the active state with an icon.
 */
export function SortableHeader({
  column,
  sort,
  onSort,
  className,
  children,
}: SortableHeaderProps) {
  const active = sort?.column === column
  const Icon = !active ? ArrowUpDown : sort.order === 'asc' ? ArrowUp : ArrowDown

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'flex items-center gap-1.5 font-medium transition-colors hover:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {children}
        <Icon className="size-3.5" />
      </button>
    </TableHead>
  )
}

/**
 * Standard cycle used by every listing: asc → desc → cleared.
 */
export function nextSortState(current: SortState | null, column: string): SortState | null {
  if (current?.column !== column) return { column, order: 'asc' }
  if (current.order === 'asc') return { column, order: 'desc' }
  return null
}
