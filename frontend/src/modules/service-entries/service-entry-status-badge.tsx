import { Badge } from '@/components/ui/badge'
import type { ServiceEntryStatus } from '@/types/api'

/**
 * Badge do status da entrada — fonte única do rótulo e da cor, para a listagem
 * e o form não divergirem.
 *
 * As cores vêm de **tokens** do design system (`secondary`, `success`,
 * `destructive`), nunca de cores fixas: é o que faz o dark mode continuar
 * legível.
 */
const LABELS: Record<ServiceEntryStatus, { label: string; variant: 'secondary' | 'success' | 'destructive' }> = {
  open: { label: 'Aberta', variant: 'secondary' },
  finalized: { label: 'Finalizada', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
}

export function ServiceEntryStatusBadge({ status }: { status: ServiceEntryStatus }) {
  const { label, variant } = LABELS[status]
  return <Badge variant={variant}>{label}</Badge>
}
