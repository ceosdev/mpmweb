import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { inventoriesApi } from '@/services/inventories-api'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { formatDecimalString } from '@/lib/quantity'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function Summary({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="rounded-md border px-3 py-2" data-testid={testId}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function Section({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
      <div className="rounded-md border">{children}</div>
    </section>
  )
}

export function CloseInventoryDialog({
  inventoryId,
  open,
  onOpenChange,
}: {
  inventoryId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Remonta o conteúdo a cada abertura: o preview é sempre buscado de novo.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <CloseContent inventoryId={inventoryId} onOpenChange={onOpenChange} />}
    </Dialog>
  )
}

function CloseContent({
  inventoryId,
  onOpenChange,
}: {
  inventoryId: number
  onOpenChange: (open: boolean) => void
}) {
  const { tenant } = useAuth()
  const companyId = tenant?.companyId
  const queryClient = useQueryClient()

  const preview = useQuery({
    queryKey: ['inventories', companyId, inventoryId, 'close-preview'],
    queryFn: () => inventoriesApi.closePreview(inventoryId),
    enabled: !!companyId,
    gcTime: 0,
  })
  const data = preview.data

  const closeMutation = useMutation({
    mutationFn: () => inventoriesApi.close(inventoryId),
    onSuccess: () => {
      toast.success('Inventário fechado.')
      queryClient.invalidateQueries({ queryKey: ['inventories', companyId] })
      queryClient.invalidateQueries({ queryKey: ['products', companyId] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Fechar inventário</DialogTitle>
        <DialogDescription>Deseja realmente finalizar o ajuste de inventário?</DialogDescription>
      </DialogHeader>

      {preview.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{getErrorMessage(preview.error)}</AlertDescription>
        </Alert>
      ) : !data ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Summary label="Itens" value={data.itemCount} testId="close-items" />
            <Summary label="Contados" value={data.countedCount} testId="close-counted" />
            <Summary label="Não contados" value={data.uncountedCount} testId="close-uncounted" />
            <Summary label="Vão mudar de estoque" value={data.changingCount} testId="close-changing" />
          </div>

          {data.uncountedCount > 0 && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>
                {data.uncountedCount === 1
                  ? '1 produto não foi contado e terá o estoque zerado.'
                  : `${data.uncountedCount} produtos não foram contados e terão o estoque zerado.`}
              </AlertDescription>
            </Alert>
          )}

          {data.moved.length > 0 && (
            <Section
              title="Movimentados desde a abertura"
              text="Estes produtos tiveram entrada ou saída depois da abertura. Ao fechar, o estoque deles passa a ser a quantidade contada."
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Estoque na abertura</TableHead>
                    <TableHead className="text-right">Estoque atual</TableHead>
                    <TableHead className="text-right">Contado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.moved.map((m) => (
                    <TableRow key={m.productId}>
                      <TableCell>{m.productDescription}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDecimalString(m.stockQuantity)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDecimalString(m.currentStock)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.countedQuantity === null ? '—' : formatDecimalString(m.countedQuantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )}

          {data.toolsOnLoan.length > 0 && (
            <Section
              title="Ferramentas emprestadas"
              text="Estas ferramentas estão com funcionários e não devem estar na contagem. Ao serem devolvidas, voltam a somar no estoque."
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Saída</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Ferramenta</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.toolsOnLoan.map((t) => (
                    <TableRow key={`${t.goodsExitId}-${t.productId}`}>
                      <TableCell className="tabular-nums">{t.goodsExitId}</TableCell>
                      <TableCell>{t.employeeName}</TableCell>
                      <TableCell>{t.productDescription}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDecimalString(t.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )}

          {data.notAdjusted.length > 0 && (
            <Section
              title="Não ajustados"
              text="Estes produtos não controlam mais estoque e não serão ajustados."
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.notAdjusted.map((n) => (
                    <TableRow key={n.productId}>
                      <TableCell>{n.productDescription}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={closeMutation.isPending}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          onClick={() => closeMutation.mutate()}
          disabled={!data || closeMutation.isPending}
        >
          {closeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Fechar inventário
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
