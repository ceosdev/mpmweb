import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { goodsEntriesApi } from '@/services/goods-entries-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency, formatQuantity } from '@/lib/masks'
import { cn } from '@/lib/utils'
import type { GoodsEntry, GoodsEntryFinalizePreview } from '@/types/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface FinalizeGoodsEntryDialogProps {
  entry: GoodsEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Confirmação de "Finalizar entrada de mercadoria". O resumo, o rateio das
 * parcelas e os vencimentos sugeridos vêm do `finalize-preview` (a conta tem um
 * dono só: o backend). O usuário só edita os **vencimentos**; valores não.
 */
export function FinalizeGoodsEntryDialog({
  entry,
  open,
  onOpenChange,
}: FinalizeGoodsEntryDialogProps) {
  const { tenant } = useAuth()
  const companyId = tenant?.companyId
  const entryId = entry?.id
  // Espelha o `isPending` da finalização (vive no corpo) para travar Esc/overlay.
  const [busy, setBusy] = useState(false)

  function guardedOpenChange(next: boolean) {
    if (busy) return
    onOpenChange(next)
  }

  const previewQuery = useQuery({
    queryKey: ['goods-entry-finalize-preview', companyId, entryId],
    queryFn: () => goodsEntriesApi.finalizePreview(entryId as number),
    enabled: open && entryId !== undefined,
    // O preview depende do estado atual dos produtos: nunca reaproveitar.
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  if (!entry) return null

  return (
    <Dialog open={open} onOpenChange={guardedOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Finalizar entrada</DialogTitle>
          <DialogDescription>
            Confira o resumo e ajuste os vencimentos antes de gerar os títulos a pagar e lançar o
            estoque.
          </DialogDescription>
        </DialogHeader>

        {previewQuery.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : previewQuery.isError ? (
          <>
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>{getErrorMessage(previewQuery.error)}</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <FinalizeBody
            entry={entry}
            preview={previewQuery.data}
            onOpenChange={onOpenChange}
            onPendingChange={setBusy}
            previewKey={['goods-entry-finalize-preview', companyId, entry.id]}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function validateDueDates(dueDates: string[], issueDate: string): (string | null)[] {
  return dueDates.map((date, index) => {
    const n = index + 1
    if (!date) return `Informe o vencimento da parcela ${n}.`
    if (date < issueDate) return `O vencimento da parcela ${n} não pode ser anterior à emissão.`
    if (index > 0 && dueDates[index - 1] && date < dueDates[index - 1]) {
      return `O vencimento da parcela ${n} não pode ser anterior ao da parcela ${n - 1}.`
    }
    return null
  })
}

function FinalizeBody({
  entry,
  preview,
  onOpenChange,
  onPendingChange,
  previewKey,
}: {
  entry: GoodsEntry
  preview: GoodsEntryFinalizePreview
  onOpenChange: (open: boolean) => void
  onPendingChange: (pending: boolean) => void
  previewKey: unknown[]
}) {
  const { tenant } = useAuth()
  const companyId = tenant?.companyId
  const queryClient = useQueryClient()

  const [dueDates, setDueDates] = useState<string[]>(() =>
    preview.installments.map((i) => i.dueDate.slice(0, 10)),
  )
  const [serverError, setServerError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => goodsEntriesApi.finalize(entry.id, dueDates),
    onSuccess: () => {
      toast.success('Entrada finalizada. Estoque, ativos e títulos a pagar foram lançados.')
      for (const key of ['goods-entries', 'goods-entry', 'payables', 'products', 'product-assets']) {
        queryClient.invalidateQueries({ queryKey: [key, companyId] })
      }
      queryClient.invalidateQueries({ queryKey: previewKey })
      onOpenChange(false)
    },
    onError: (error) => setServerError(getErrorMessage(error)),
  })

  useEffect(() => {
    onPendingChange(mutation.isPending)
    return () => onPendingChange(false)
  }, [mutation.isPending, onPendingChange])

  const errors = validateDueDates(dueDates, entry.issueDate.slice(0, 10))
  const firstError = errors.find((e) => e !== null) ?? null

  const netNonPositive = preview.netAmount <= 0
  const amountNonPositive = preview.installments.some((i) => i.amount <= 0)
  const blockMessage = netNonPositive
    ? 'O valor da nota é zero ou negativo. Revise os descontos.'
    : amountNonPositive
      ? `O valor da nota não permite dividir em ${preview.installments.length} parcelas.`
      : null

  const taxes = entry.icmsSt + entry.ipi
  const others = entry.freight + entry.insurance + entry.otherExpenses
  // Se a linha não bate com o preview (entrada editada), cai no total único.
  const canSplit = Math.round((taxes + others) * 100) === Math.round(preview.additions * 100)

  function handleOpenChange(next: boolean) {
    if (mutation.isPending) return
    onOpenChange(next)
  }

  function setDate(index: number, value: string) {
    setServerError(null)
    setDueDates((prev) => prev.map((d, i) => (i === index ? value : d)))
  }

  return (
    <>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto text-sm">
        <div className="space-y-1.5 rounded-lg border bg-muted/30 p-4">
          <SummaryRow label="Total dos produtos" value={formatCurrency(preview.itemsTotal)} />
          <SummaryRow label="Desconto da NF-e" value={formatCurrency(preview.discount)} sign="−" />
          {canSplit ? (
            <>
              <SummaryRow label="ICMS ST + IPI" value={formatCurrency(taxes)} sign="+" />
              <SummaryRow label="Frete, seguro, outras" value={formatCurrency(others)} sign="+" />
            </>
          ) : (
            <SummaryRow
              label="Acréscimos (ICMS ST, IPI, frete, seguro, outras)"
              value={formatCurrency(preview.additions)}
              sign="+"
            />
          )}
          <Separator className="my-2" />
          <SummaryRow label="Valor da nota" value={formatCurrency(preview.netAmount)} emphasis />
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Parcelas</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Parcela</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-48">Vencimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.installments.map((inst, index) => (
                <TableRow key={inst.installment}>
                  <TableCell>
                    {inst.installment}/{preview.installments.length}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(inst.amount)}</TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      aria-label={`Vencimento da parcela ${inst.installment}`}
                      aria-invalid={errors[index] ? true : undefined}
                      value={dueDates[index] ?? ''}
                      disabled={mutation.isPending}
                      onChange={(e) => setDate(index, e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {firstError && <p className="mt-2 text-sm text-destructive">{firstError}</p>}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Efeito nos produtos
          </h3>
          <ul className="space-y-1">
            {preview.effects.map((effect) => (
              <li key={effect.productId} className="text-muted-foreground">
                <span className="font-medium text-foreground">{effect.description}</span>
                {' — '}
                {effect.effect === 'asset'
                  ? `gera ${effect.assetsToCreate} ${effect.assetsToCreate === 1 ? 'ativo' : 'ativos'}`
                  : effect.effect === 'stock'
                    ? `+${formatQuantity(Number(effect.quantity))} no estoque`
                    : 'atualiza o custo'}
              </li>
            ))}
          </ul>
        </div>

        {blockMessage && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{blockMessage}</AlertDescription>
          </Alert>
        )}
        {serverError && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
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
          onClick={() => {
            setServerError(null)
            mutation.mutate()
          }}
          disabled={mutation.isPending || firstError !== null || blockMessage !== null}
        >
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Finalizar entrada
        </Button>
      </DialogFooter>
    </>
  )
}

function SummaryRow({
  label,
  value,
  sign,
  emphasis,
}: {
  label: string
  value: string
  sign?: '+' | '−'
  emphasis?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between', emphasis && 'font-semibold')}>
      <span className={emphasis ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className="text-foreground">{sign ? `${sign} ${value}` : value}</span>
    </div>
  )
}
