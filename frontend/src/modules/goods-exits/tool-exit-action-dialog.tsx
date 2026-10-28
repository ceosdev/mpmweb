import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { goodsExitsApi } from '@/services/goods-exits-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { openPdf } from '@/lib/open-pdf'
import { formatDecimalString } from '@/lib/quantity'
import { ConfirmDialog } from '@/components/confirm-dialog'

const COPY = {
  deliver: {
    title: 'Entregar mercadoria',
    description: 'Deseja realmente entregar a mercadoria para o destinatário?',
    confirmLabel: 'Sim',
    success: 'Mercadoria entregue.',
  },
  return: {
    title: 'Devolver mercadoria',
    description: 'Deseja realmente devolver a mercadoria para o estoque?',
    confirmLabel: 'Sim',
    success: 'Mercadoria devolvida ao estoque.',
  },
} as const

interface ToolExitActionDialogProps {
  action: 'deliver' | 'return'
  exitId: number | null
  onOpenChange: (open: boolean) => void
}

/**
 * Confirmação de "Entregar" / "Devolver" uma saída de ferramentas, com a lista
 * de itens. No clique do **Sim** a aba do protocolo é aberta antes da chamada
 * (senão o navegador a bloqueia como popup).
 */
export function ToolExitActionDialog({ action, exitId, onOpenChange }: ToolExitActionDialogProps) {
  const { tenant } = useAuth()
  const companyId = tenant?.companyId
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const copy = COPY[action]

  const detailQuery = useQuery({
    queryKey: ['goods-exits', companyId, 'detail', exitId],
    queryFn: () => goodsExitsApi.get(exitId as number),
    enabled: exitId !== null,
    staleTime: 0,
    gcTime: 0,
  })

  const items = detailQuery.data?.items ?? []
  const list = items.length
    ? ` Itens: ${items
        .map((i) => `${i.productDescription ?? '—'} (${formatDecimalString(i.requestedQuantity)})`)
        .join(', ')}.`
    : ''

  async function handleConfirm() {
    if (exitId === null) return
    const tab = window.open('', '_blank')
    setPending(true)
    try {
      await (action === 'deliver' ? goodsExitsApi.deliver(exitId) : goodsExitsApi.returnTools(exitId))
    } catch (error) {
      tab?.close()
      toast.error(getErrorMessage(error))
      setPending(false)
      return
    }
    setPending(false)
    toast.success(copy.success)
    queryClient.invalidateQueries({ queryKey: ['goods-exits', companyId] })
    queryClient.invalidateQueries({ queryKey: ['goods-exit', companyId] })
    queryClient.invalidateQueries({ queryKey: ['products', companyId] })
    onOpenChange(false)
    void openPdf(() => goodsExitsApi.protocol(exitId), tab)
  }

  return (
    <ConfirmDialog
      open={exitId !== null}
      onOpenChange={(open) => !pending && onOpenChange(open)}
      title={copy.title}
      description={`${copy.description}${list}`}
      confirmLabel={copy.confirmLabel}
      confirmVariant="default"
      loading={pending}
      onConfirm={() => void handleConfirm()}
    />
  )
}
