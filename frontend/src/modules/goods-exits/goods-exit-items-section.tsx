import { useMemo, useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { PackageOpen, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, maskQuantity, parseQuantity } from '@/lib/masks'
import { lineGrossCents } from '@/lib/decimal'
import type { GoodsExitType, ProductLookup } from '@/types/api'
import type { GoodsExitItemFormValue } from './goods-exit-form-values'
import { EmptyState } from '@/components/empty-state'
import { EntityPicker } from '@/components/common/entity-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface FormValuesWithItems {
  exitType: GoodsExitType
  items: GoodsExitItemFormValue[]
}

export interface GoodsExitItemsSectionProps {
  name: 'items'
  readOnly?: boolean
}

/** Valor requisitado da linha em centavos; custo `null` conta como 0. */
function lineCents(item: Pick<GoodsExitItemFormValue, 'quantity' | 'costPrice'>): bigint {
  const quantity = parseQuantity(item.quantity)
  if (quantity === null) return 0n
  return lineGrossCents(quantity, item.costPrice ?? '0')
}

function centsToCurrency(value: bigint): string {
  return formatCurrency(Number(value) / 100)
}

/**
 * Produtos da saída: linha de entrada (produto, qtd., +) acima da tabela. O
 * picker segue o tipo da saída (consumo ou ferramenta). Valores calculados em
 * centavos via `BigInt` — só exibição, o backend é a autoridade.
 */
export function GoodsExitItemsSection({ name, readOnly = false }: GoodsExitItemsSectionProps) {
  const { control } = useFormContext<FormValuesWithItems>()
  const { fields, append, remove } = useFieldArray({ control, name })
  const exitType = useWatch({ control, name: 'exitType' })

  const [draftProduct, setDraftProduct] = useState<ProductLookup | null>(null)
  const [draftQuantity, setDraftQuantity] = useState('')
  const [quantityError, setQuantityError] = useState<string | null>(null)

  const total = useMemo(() => fields.reduce((sum, item) => sum + lineCents(item), 0n), [fields])

  function resetDraft() {
    setDraftProduct(null)
    setDraftQuantity('')
    setQuantityError(null)
  }

  function validateQuantity(quantity: string | null): string | null {
    if (quantity === null || /^0*(\.0*)?$/.test(quantity)) return 'Informe a quantidade.'
    return null
  }

  function handleQuantityChange(raw: string) {
    const masked = maskQuantity(raw)
    setDraftQuantity(masked)
    setQuantityError(masked ? validateQuantity(parseQuantity(masked)) : null)
  }

  function handleAdd() {
    if (!draftProduct) {
      toast.error('Selecione um produto.')
      return
    }
    if (fields.some((item) => item.productId === draftProduct.id)) {
      toast.error('Este produto já está na saída.')
      return
    }
    const error = validateQuantity(parseQuantity(draftQuantity))
    if (error) {
      setQuantityError(error)
      return
    }
    append({
      productId: draftProduct.id,
      productDescription: draftProduct.description,
      productType: draftProduct.type,
      unitOfMeasure: draftProduct.unitOfMeasure ?? '',
      quantity: draftQuantity,
      costPrice: draftProduct.costPrice,
    })
    resetDraft()
  }

  /** Enter nos inputs do rascunho adiciona a linha — nunca submete o form da saída. */
  function handleDraftKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleAdd()
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="grid gap-3 md:grid-cols-12 md:items-start">
          <div className="space-y-1.5 md:col-span-7">
            <Label htmlFor="itemProductId" className="text-sm">
              Produto
            </Label>
            <EntityPicker
              // Remonta ao trocar o tipo: a busca em cache não serve no outro.
              key={exitType}
              id="itemProductId"
              source={exitType === 'tool' ? 'toolProduct' : 'consumableStockProduct'}
              value={draftProduct ? draftProduct.id : null}
              onChange={(value) => {
                if (value === null) resetDraft()
              }}
              onSelectOption={(option) => setDraftProduct(option.data as ProductLookup)}
            />
          </div>

          <div className="space-y-1.5 md:col-span-4">
            <Label htmlFor="itemQuantity" className="text-sm">
              Qtd.
            </Label>
            <Input
              id="itemQuantity"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={draftQuantity}
              aria-invalid={quantityError ? true : undefined}
              onKeyDown={handleDraftKeyDown}
              onChange={(event) => handleQuantityChange(event.target.value)}
            />
            {quantityError && <p className="text-xs text-destructive">{quantityError}</p>}
          </div>

          <div className="space-y-1.5 md:col-span-1">
            <Label aria-hidden className="invisible text-sm">
              Adicionar
            </Label>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={handleAdd}
              disabled={Boolean(quantityError)}
              aria-label="Adicionar produto"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {fields.length === 0 ? (
        <EmptyState icon={PackageOpen} title="Nenhum produto adicionado." />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead className="text-right">Qtd. requisitada</TableHead>
                  <TableHead className="text-right">Valor requisitado</TableHead>
                  {!readOnly && <TableHead className="w-0" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.productId}</TableCell>
                    <TableCell>{field.productDescription}</TableCell>
                    <TableCell>{field.unitOfMeasure || '—'}</TableCell>
                    <TableCell className="text-right">{field.quantity}</TableCell>
                    <TableCell className="text-right font-medium">
                      {centsToCurrency(lineCents(field))}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="destructive"
                          onClick={() => remove(index)}
                          aria-label={`Remover ${field.productDescription}`}
                        >
                          <X className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Quantidade de produtos:{' '}
              <span className="font-medium text-foreground">{fields.length}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Total requisitado</span>
              <span className="font-semibold">{centsToCurrency(total)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
