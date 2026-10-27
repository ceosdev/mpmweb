import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { goodsExitsApi } from '@/services/goods-exits-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { compareQuantity, lineGrossCents } from '@/lib/decimal'
import { formatCurrency, maskQuantity, parseQuantity } from '@/lib/masks'
import { openPdf } from '@/lib/open-pdf'
import { formatDecimalString } from '@/modules/goods-exits/quantity'
import type { GoodsExitFinalizePreview } from '@/types/api'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface FinalizeGoodsExitDialogProps {
  exitId: number | null
  onOpenChange: (open: boolean) => void
}

type PreviewItem = GoodsExitFinalizePreview['items'][number]

/**
 * "Finalizar saída": o estoque e o custo atuais vêm do `finalize-preview`; o
 * usuário informa a quantidade **consumida** de cada item (pré-preenchida com
 * `min(requisitada, estoque)`). O backend revalida tudo sob trava.
 */
export function FinalizeGoodsExitDialog({ exitId, onOpenChange }: FinalizeGoodsExitDialogProps) {
  const { tenant } = useAuth()
  const companyId = tenant?.companyId
  const [busy, setBusy] = useState(false)

  const previewQuery = useQuery({
    queryKey: ['goods-exits', companyId, 'finalize-preview', exitId],
    queryFn: () => goodsExitsApi.finalizePreview(exitId as number),
    enabled: exitId !== null,
    // Estoque e custo mudam a todo momento: nunca reaproveitar.
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  return (
    <Dialog open={exitId !== null} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Finalizar saída</DialogTitle>
          <DialogDescription>
            Informe a quantidade realmente consumida de cada item. O que não for consumido
            permanece no estoque.
          </DialogDescription>
        </DialogHeader>

        {exitId === null || previewQuery.isPending ? (
          <Skeleton className="h-40 w-full" />
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
            exitId={exitId}
            items={previewQuery.data.items}
            onOpenChange={onOpenChange}
            onBusyChange={setBusy}
            onRefresh={async () => (await previewQuery.refetch()).data?.items ?? null}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function validate(item: PreviewItem, masked: string): string | null {
  const parsed = parseQuantity(masked)
  if (parsed === null) return `Informe a quantidade de consumo de ${item.productDescription}.`
  if (compareQuantity(parsed, item.requestedQuantity) > 0) {
    return `A quantidade de consumo de ${item.productDescription} não pode ser superior à quantidade requisitada.`
  }
  if (compareQuantity(parsed, item.stock) > 0) {
    return `A quantidade de consumo de ${item.productDescription} não pode ser superior ao estoque atual.`
  }
  return null
}

function FinalizeBody({
  exitId,
  items,
  onOpenChange,
  onBusyChange,
  onRefresh,
}: {
  exitId: number
  items: PreviewItem[]
  onOpenChange: (open: boolean) => void
  onBusyChange: (busy: boolean) => void
  onRefresh: () => Promise<PreviewItem[] | null>
}) {
  const { tenant } = useAuth()
  const companyId = tenant?.companyId
  const queryClient = useQueryClient()

  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(items.map((i) => [i.productId, formatDecimalString(i.suggestedConsumed)])),
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const errors = items.map((item) => validate(item, values[item.productId] ?? ''))
  const firstError = errors.find((e) => e !== null) ?? null

  let totalCents = 0n
  const lineCents = items.map((item, index) => {
    const parsed = errors[index] === null ? parseQuantity(values[item.productId] ?? '') : null
    const cents = parsed === null ? 0n : lineGrossCents(parsed, item.unitCost ?? '0')
    totalCents += cents
    return cents
  })

  function setPendingBoth(next: boolean) {
    setPending(next)
    onBusyChange(next)
  }

  async function handleConfirm() {
    // Aba aberta no clique, antes de qualquer await (senão é bloqueada como popup).
    const tab = window.open('', '_blank')
    setPendingBoth(true)
    setServerError(null)
    try {
      await goodsExitsApi.finalize(
        exitId,
        items.map((item) => ({
          productId: item.productId,
          consumedQuantity: parseQuantity(values[item.productId] ?? '') as string,
        })),
      )
    } catch (error) {
      tab?.close()
      const message = getErrorMessage(error)
      toast.error(message)
      setConfirmOpen(false)
      // O estoque pode ter mudado (motivo comum da recusa): recarrega e re-semeia o consumo.
      const fresh = await onRefresh()
      if (fresh) {
        setValues(
          Object.fromEntries(
            fresh.map((i) => [i.productId, formatDecimalString(i.suggestedConsumed)]),
          ),
        )
      }
      setServerError(message)
      setPendingBoth(false)
      return
    }
    toast.success('Saída de mercadoria finalizada.')
    queryClient.invalidateQueries({ queryKey: ['goods-exits', companyId] })
    queryClient.invalidateQueries({ queryKey: ['goods-exit', companyId] })
    queryClient.invalidateQueries({ queryKey: ['products', companyId] })
    setPendingBoth(false)
    onOpenChange(false)
    void openPdf(() => goodsExitsApi.protocol(exitId), tab)
  }

  return (
    <>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Código</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead className="text-right">Qtd. requisitada</TableHead>
              <TableHead className="w-36">Qtd. consumida</TableHead>
              <TableHead className="text-right">Valor consumido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.productId}>
                <TableCell>{item.productId}</TableCell>
                <TableCell>
                  {item.productDescription}
                  {item.unitOfMeasure && (
                    <span className="ml-1 text-xs text-muted-foreground">({item.unitOfMeasure})</span>
                  )}
                </TableCell>
                <TableCell className="text-right">{formatDecimalString(item.stock)}</TableCell>
                <TableCell className="text-right">
                  {formatDecimalString(item.requestedQuantity)}
                </TableCell>
                <TableCell>
                  <Input
                    inputMode="decimal"
                    className="text-right"
                    aria-label={`Quantidade consumida de ${item.productDescription}`}
                    aria-invalid={errors[index] ? true : undefined}
                    value={values[item.productId] ?? ''}
                    disabled={pending}
                    onChange={(e) => {
                      setServerError(null)
                      setValues((prev) => ({
                        ...prev,
                        [item.productId]: maskQuantity(e.target.value),
                      }))
                    }}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(lineCents[index]) / 100)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2 font-semibold">
          <span>Valor total consumido</span>
          <span>{formatCurrency(Number(totalCents) / 100)}</span>
        </div>

        {firstError && <p className="text-sm text-destructive">{firstError}</p>}
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
          onClick={() => onOpenChange(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={pending || firstError !== null}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Finalizar
        </Button>
      </DialogFooter>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(next) => !pending && setConfirmOpen(next)}
        title="Finalizar saída"
        description="Deseja realmente finalizar a saída de mercadoria?"
        confirmLabel="Sim"
        confirmVariant="default"
        loading={pending}
        onConfirm={() => void handleConfirm()}
      />
    </>
  )
}
