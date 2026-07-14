import { Badge } from '@/components/ui/badge'
import type { PayableStatus } from '@/types/api'

/**
 * Badge do status do título — fonte única do rótulo e da cor, para a listagem e
 * o modal não divergirem.
 *
 * As cores vêm de **tokens** do design system (`secondary`, `info`, `success`,
 * `destructive`), nunca de cores fixas: é o que faz o dark mode continuar
 * legível.
 */
const STATUS_LABELS: Record<PayableStatus, string> = {
  open: 'Aberto',
  partially_paid: 'Pago parcial',
  paid: 'Pago',
  cancelled: 'Cancelado',
}

const STATUS_VARIANTS: Record<PayableStatus, 'secondary' | 'info' | 'success' | 'destructive'> = {
  open: 'secondary', // cinza — nada baixado ainda
  partially_paid: 'info', // azul — baixado em parte
  paid: 'success', // verde — quitado
  cancelled: 'destructive', // vermelho — não se deve mais nada
}

export function PayableStatusBadge({ status }: { status: PayableStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
}
