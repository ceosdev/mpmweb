import { Badge } from '@/components/ui/badge'
import type { InventoryStatus } from '@/types/api'

/** Badge do status do inventário — fonte única do rótulo e da cor (tokens). */
const LABELS: Record<InventoryStatus, { label: string; variant: 'secondary' | 'success' }> = {
  open: { label: 'Aberto', variant: 'secondary' },
  closed: { label: 'Fechado', variant: 'success' },
}

export function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  const { label, variant } = LABELS[status]
  return <Badge variant={variant}>{label}</Badge>
}
