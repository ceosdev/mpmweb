import { Badge } from '@/components/ui/badge'
import type { ReceivableStatus } from '@/types/api'

/**
 * Badge do status do título a receber — fonte única do rótulo e da cor. Espelha
 * o de contas a pagar, mas do lado do recebimento: `paid` é *Recebido* e
 * `partially_paid` é *Recebido parcial*.
 *
 * As cores vêm de **tokens** do design system, nunca de cores fixas.
 */
const STATUS_LABELS: Record<ReceivableStatus, string> = {
  open: 'Aberto',
  partially_paid: 'Recebido parcial',
  paid: 'Recebido',
  cancelled: 'Cancelado',
}

const STATUS_VARIANTS: Record<ReceivableStatus, 'secondary' | 'info' | 'success' | 'destructive'> =
  {
    open: 'secondary', // cinza — nada recebido ainda
    partially_paid: 'info', // azul — recebido em parte
    paid: 'success', // verde — quitado
    cancelled: 'destructive', // vermelho — não se recebe mais nada
  }

export function ReceivableStatusBadge({ status }: { status: ReceivableStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
}
