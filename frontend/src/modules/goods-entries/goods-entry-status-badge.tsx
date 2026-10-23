import { Badge } from '@/components/ui/badge'
import type { GoodsEntryStatus } from '@/types/api'

/** Badge do status da entrada — fonte única do rótulo e da cor (tokens). */
const LABELS: Record<GoodsEntryStatus, { label: string; variant: 'secondary' | 'success' | 'destructive' }> = {
  open: { label: 'Aberta', variant: 'secondary' },
  finalized: { label: 'Finalizada', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
}

export function GoodsEntryStatusBadge({ status }: { status: GoodsEntryStatus }) {
  const { label, variant } = LABELS[status]
  return <Badge variant={variant}>{label}</Badge>
}
