import { Badge } from '@/components/ui/badge'
import type { GoodsExitStatus } from '@/types/api'

/** Badge do status da saída — fonte única do rótulo e da cor (tokens). */
const LABELS: Record<GoodsExitStatus, { label: string; variant: 'secondary' | 'success' | 'info' | 'outline' }> = {
  open: { label: 'Aberta', variant: 'secondary' },
  finalized: { label: 'Finalizada', variant: 'success' },
  delivered: { label: 'Entregue', variant: 'info' },
  returned: { label: 'Devolvida', variant: 'outline' },
}

export function GoodsExitStatusBadge({ status }: { status: GoodsExitStatus }) {
  const { label, variant } = LABELS[status]
  return <Badge variant={variant}>{label}</Badge>
}
