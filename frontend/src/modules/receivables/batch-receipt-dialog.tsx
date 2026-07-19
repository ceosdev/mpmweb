import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { receivablesApi } from '@/services/receivables-api'
import { paymentTypesApi } from '@/services/payment-types-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency } from '@/lib/masks'
import type { Receivable } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BatchReceiptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Os títulos selecionados no grid (Abertos ou Parciais). */
  receivables: Receivable[]
  /** Sucesso do lote: o chamador limpa a seleção, sai do modo e invalida caches. */
  onSettled: () => void
}

/**
 * Recebimento em lote: escolhe **uma** forma de pagamento e baixa todos os
 * títulos selecionados na data de hoje, cada um pelo saldo restante. O backend
 * deriva valor e data — aqui só enviamos ids + tipo. Ver
 * `docs/spec/financeiro/004-contas-a-receber.md`.
 */
export function BatchReceiptDialog({
  open,
  onOpenChange,
  receivables,
  onSettled,
}: BatchReceiptDialogProps) {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  const [paymentTypeId, setPaymentTypeId] = useState('')

  const count = receivables.length
  const totalToReceive = useMemo(
    () => receivables.reduce((sum, row) => sum + row.balance, 0),
    [receivables]
  )

  const paymentTypesQuery = useQuery({
    queryKey: ['payment-types', companyId, 'options'],
    queryFn: () =>
      paymentTypesApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
    enabled: open,
  })

  // No lote só oferecemos tipos ativos (não há tipo "já vinculado" a preservar).
  const activeTypes = useMemo(
    () => (paymentTypesQuery.data?.data ?? []).filter((type) => type.isActive),
    [paymentTypesQuery.data]
  )

  const mutation = useMutation({
    mutationFn: () =>
      receivablesApi.batchSettle(
        receivables.map((row) => row.id),
        Number(paymentTypeId)
      ),
    onSuccess: (result) => {
      toast.success(
        `${result.settledCount} ${result.settledCount === 1 ? 'título recebido' : 'títulos recebidos'} em lote.`
      )
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['receivable-settlements'] })
      setPaymentTypeId('')
      onSettled()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function handleOpenChange(next: boolean) {
    if (!next) setPaymentTypeId('')
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receber títulos em lote</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="batchPaymentType" className="mb-1.5 block text-sm">
              Forma de pagamento
            </Label>
            <Select value={paymentTypeId} onValueChange={setPaymentTypeId}>
              <SelectTrigger id="batchPaymentType" className="w-full">
                <SelectValue
                  placeholder={paymentTypesQuery.isLoading ? 'Carregando…' : 'Selecione'}
                />
              </SelectTrigger>
              <SelectContent>
                {activeTypes.map((type) => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    {type.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destaque do modal: o aviso pedido, com o resumo do que será recebido. */}
          <div className="flex items-start gap-3 rounded-lg border-2 border-info/50 bg-info/10 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-info" />
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                Atenção: esta opção irá receber todos os títulos selecionados com a mesma
                forma de pagamento e na data de hoje. Deseja continuar?
              </p>
              <p className="text-muted-foreground">
                {count} {count === 1 ? 'título selecionado' : 'títulos selecionados'} ·{' '}
                total a receber{' '}
                <span className="font-semibold text-foreground">{formatCurrency(totalToReceive)}</span>
              </p>
            </div>
          </div>
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
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !paymentTypeId}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Sim, receber em lote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
