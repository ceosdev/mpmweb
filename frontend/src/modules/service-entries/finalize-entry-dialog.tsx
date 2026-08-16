import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { serviceEntriesApi } from '@/services/service-entries-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency } from '@/lib/masks'
import { formatIsoDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ServiceEntry } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface FinalizeEntryDialogProps {
  entry: ServiceEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmed: () => void
}

/**
 * Confirmação de "Finalizar entrada": mostra o resumo do que vai ser gerado
 * — valor a pagar e o parcelamento — **antes** de disparar a ação real.
 *
 * A prévia de parcela usa a mesma regra do backend (`floor` + resíduo na
 * última), mas só para exibição: quem faz a conta de verdade (rateio,
 * vencimentos, baixa automática) é o `POST /finalize`, dentro da transação.
 */
export function FinalizeEntryDialog({
  entry,
  open,
  onOpenChange,
  onConfirmed,
}: FinalizeEntryDialogProps) {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (id: number) => serviceEntriesApi.finalize(id),
    onSuccess: () => {
      toast.success('Entrada finalizada. Os títulos a pagar foram gerados.')
      queryClient.invalidateQueries({ queryKey: ['service-entries', tenant?.companyId] })
      queryClient.invalidateQueries({ queryKey: ['payables', tenant?.companyId] })
      onConfirmed()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (!entry) return null

  const isRecipientWithholding = entry.taxWithholding === 'recipient'

  // Contas em centavos, para não confiar em ponto flutuante na fronteira.
  const netAmountCents = Math.round(entry.netAmount * 100)
  const installmentCents = Math.floor(netAmountCents / entry.installmentCount)
  const hasRemainder = installmentCents * entry.installmentCount !== netAmountCents
  const installmentValue = installmentCents / 100

  function handleOpenChange(next: boolean) {
    if (mutation.isPending) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalizar entrada</DialogTitle>
          <DialogDescription>
            Confira o valor a pagar antes de gerar os títulos a pagar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="space-y-1.5 rounded-lg border bg-muted/30 p-4">
            <SummaryRow label="Total dos serviços" value={formatCurrency(entry.itemsTotal)} />
            <SummaryRow
              label="Desconto da NFe"
              value={formatCurrency(entry.discount)}
              subtract
            />
            {isRecipientWithholding ? (
              <SummaryRow
                label="Impostos retidos"
                value={formatCurrency(entry.withheldTaxes)}
                subtract
              />
            ) : (
              <p className="pt-0.5 text-xs text-muted-foreground">
                Retenção por parte do emissor — nada é abatido.
              </p>
            )}
            <Separator className="my-2" />
            <SummaryRow label="Valor a pagar" value={formatCurrency(entry.netAmount)} emphasis />
          </div>

          <p className="text-muted-foreground">
            {entry.installmentCount} {entry.installmentCount === 1 ? 'parcela' : 'parcelas'} de{' '}
            <span className="font-medium text-foreground">
              {formatCurrency(installmentValue)}
            </span>
            , a partir de {formatIsoDate(entry.firstDueDate)}.
            {hasRemainder && ' (a última parcela absorve a diferença)'}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => mutation.mutate(entry.id)}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Finalizar entrada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SummaryRow({
  label,
  value,
  subtract,
  emphasis,
}: {
  label: string
  value: string
  subtract?: boolean
  emphasis?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between', emphasis && 'font-semibold')}>
      <span className={emphasis ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className="text-foreground">{subtract ? `− ${value}` : value}</span>
    </div>
  )
}
