import { useMemo, useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { PackageOpen, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  formatCurrency,
  formatDecimalPrice,
  isUnitPriceDecimalMode,
  maskUnitPrice,
  maskUnitPriceDecimal,
  maskMoney,
  maskQuantity,
  parseUnitPrice,
  unitPriceToDecimalMode,
  parseQuantity,
} from '@/lib/masks'
import { lineGrossCents } from '@/lib/decimal'
import type { ProductLookup } from '@/types/api'
import type { GoodsEntryItemFormValue } from './goods-entry-form-values'
import { priceToMask } from './goods-entry-form-values'
import { MaskedInput } from '@/components/form/masked-input'
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

/** Campos do form pai que o rodapé precisa para o "Total da nota". */
interface FormValuesWithItems {
  items: GoodsEntryItemFormValue[]
  discount: string
  icmsSt: string
  ipi: string
  freight: string
  insurance: string
  otherExpenses: string
}

export interface GoodsEntryItemsSectionProps {
  name: 'items'
  readOnly?: boolean
}

const MAX_ASSET_QUANTITY = 999n

function cents(value: string | undefined): bigint {
  return value ? BigInt(value) : 0n
}

/** Bruto da linha em centavos; `0n` se a string for inválida/vazia. */
function grossOf(item: Pick<GoodsEntryItemFormValue, 'quantity' | 'unitPrice'>): bigint {
  const quantity = parseQuantity(item.quantity)
  const unitPrice = parseUnitPrice(item.unitPrice)
  if (quantity === null || unitPrice === null) return 0n
  return lineGrossCents(quantity, unitPrice)
}

function netOf(item: GoodsEntryItemFormValue): bigint {
  return grossOf(item) - cents(item.discount)
}

function centsToCurrency(value: bigint): string {
  return formatCurrency(Number(value) / 100)
}

/**
 * Sub-form dos produtos da nota: linha de entrada (produto, qtd., preço,
 * desconto) acima da tabela dos itens. Espelha
 * `service-entry-items-section.tsx`; os valores de linha são calculados em
 * centavos via `BigInt` (`lib/decimal.ts`) — só exibição, o backend é a autoridade.
 */
export function GoodsEntryItemsSection({ name, readOnly = false }: GoodsEntryItemsSectionProps) {
  const { control } = useFormContext<FormValuesWithItems>()
  const { fields, append, remove } = useFieldArray({ control, name })
  const [nfeDiscount, icmsSt, ipi, freight, insurance, otherExpenses] = useWatch({
    control,
    name: ['discount', 'icmsSt', 'ipi', 'freight', 'insurance', 'otherExpenses'],
  })

  const [draftProduct, setDraftProduct] = useState<ProductLookup | null>(null)
  const [draftQuantity, setDraftQuantity] = useState('')
  const [draftUnitPrice, setDraftUnitPrice] = useState('')
  // Preço em modo decimal (o usuário apertou a vírgula): até 4 casas em vez
  // dos centavos entrando pela direita. Ver `maskUnitPriceDecimal`.
  const [priceDecimalMode, setPriceDecimalMode] = useState(false)
  const [draftDiscount, setDraftDiscount] = useState('')
  const [quantityError, setQuantityError] = useState<string | null>(null)

  const productsTotal = useMemo(
    () => fields.reduce((sum, item) => sum + netOf(item), 0n),
    [fields]
  )
  const noteTotal =
    productsTotal -
    cents(nfeDiscount) +
    cents(icmsSt) +
    cents(ipi) +
    cents(freight) +
    cents(insurance) +
    cents(otherExpenses)

  function resetDraft() {
    setDraftProduct(null)
    setDraftQuantity('')
    setDraftUnitPrice('')
    setPriceDecimalMode(false)
    setDraftDiscount('')
    setQuantityError(null)
  }

  /** Produto ativo (ativo fixo) só aceita quantidade inteira ≤ 999. */
  function validateQuantity(quantity: string | null, product: ProductLookup | null): string | null {
    if (quantity === null || /^0*(\.0*)?$/.test(quantity)) return 'Informe a quantidade.'
    if (product?.type === 'fixed_asset') {
      const [intPart, frac = ''] = quantity.split('.')
      if (/[1-9]/.test(frac)) return 'Produto ativo exige quantidade inteira.'
      if (BigInt(intPart) > MAX_ASSET_QUANTITY) return 'A quantidade máxima para produto ativo é 999.'
    }
    return null
  }

  function handleQuantityChange(raw: string) {
    const masked = maskQuantity(raw)
    setDraftQuantity(masked)
    setQuantityError(masked ? validateQuantity(parseQuantity(masked), draftProduct) : null)
  }

  function handleAdd() {
    if (!draftProduct) {
      toast.error('Selecione um produto.')
      return
    }
    if (fields.some((item) => item.productId === draftProduct.id)) {
      toast.error('Este produto já está na entrada.')
      return
    }

    const quantity = parseQuantity(draftQuantity)
    const error = validateQuantity(quantity, draftProduct)
    if (error) {
      setQuantityError(error)
      return
    }

    const unitPrice = parseUnitPrice(draftUnitPrice)
    if (unitPrice === null) {
      toast.error('Informe o preço do produto.')
      return
    }

    const gross = lineGrossCents(quantity!, unitPrice)
    if (cents(draftDiscount) > gross) {
      toast.error('O desconto não pode ser maior que o valor total do produto.')
      return
    }

    append({
      productId: draftProduct.id,
      productDescription: draftProduct.description,
      productType: draftProduct.type,
      unitOfMeasure: draftProduct.unitOfMeasure ?? '',
      quantity: draftQuantity,
      unitPrice: draftUnitPrice,
      discount: draftDiscount || '0',
    })
    resetDraft()
  }

  /** Preço vindo do custo do produto: entra no modo que o valor exige. */
  function setPriceFromCost(masked: string) {
    setDraftUnitPrice(masked)
    setPriceDecimalMode(isUnitPriceDecimalMode(masked))
  }

  /**
   * Preço no padrão brasileiro (`R$ 0,00`, dígitos pela direita) e, quando o
   * usuário aperta a vírgula, modo decimal com até 4 casas — o `vUnCom` de fio,
   * cabo e afins (`75,7729`). Apagar a vírgula volta aos centavos.
   */
  function handlePriceChange(raw: string) {
    // Colar "75,7729" num campo vazio já entra no modo decimal.
    const pastedDecimal = !priceDecimalMode && draftUnitPrice === '' && raw.includes(',')
    if (priceDecimalMode || pastedDecimal) {
      const masked = maskUnitPriceDecimal(raw)
      if (masked !== null) {
        setDraftUnitPrice(masked)
        setPriceDecimalMode(true)
        return
      }
      setPriceDecimalMode(false)
    }
    setDraftUnitPrice(maskUnitPrice(raw))
  }

  function handlePriceKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === ',' || event.code === 'NumpadDecimal') {
      event.preventDefault()
      if (!priceDecimalMode) {
        setDraftUnitPrice(unitPriceToDecimalMode(draftUnitPrice))
        setPriceDecimalMode(true)
      }
      return
    }
    handleDraftKeyDown(event)
  }

  /** Enter nos inputs do rascunho adiciona a linha — nunca submete o form da nota. */
  function handleDraftKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleAdd()
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="grid gap-3 md:grid-cols-12 md:items-start">
          <div className="space-y-1.5 md:col-span-4">
            <Label htmlFor="itemProductId" className="text-sm">
              Produto
            </Label>
            <EntityPicker
              id="itemProductId"
              source="product"
              value={draftProduct ? draftProduct.id : null}
              onChange={(value) => {
                if (value === null) resetDraft()
              }}
              onSelectOption={(option) => {
                const product = option.data as ProductLookup
                setDraftProduct(product)
                // costPrice `null` (sem permissão ou nunca definido) → preço vazio.
                setPriceFromCost(priceToMask(product.costPrice))
                if (draftQuantity) {
                  setQuantityError(validateQuantity(parseQuantity(draftQuantity), product))
                }
              }}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
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

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="itemUnitPrice" className="text-sm">
              Preço
            </Label>
            <Input
              id="itemUnitPrice"
              inputMode="decimal"
              autoComplete="off"
              placeholder="R$ 0,00"
              title="Digite os centavos direto, ou use a vírgula para até 4 casas (ex.: 75,7729)."
              value={draftUnitPrice}
              onKeyDown={handlePriceKeyDown}
              onChange={(event) => handlePriceChange(event.target.value)}
            />
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="itemDiscount" className="text-sm">
              Desconto
            </Label>
            <MaskedInput
              id="itemDiscount"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={draftDiscount}
              onKeyDown={handleDraftKeyDown}
              onChange={setDraftDiscount}
              mask={maskMoney}
              maxDigits={12}
            />
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
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Desconto</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
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
                    <TableCell className="text-right">{formatDecimalPrice(parseUnitPrice(field.unitPrice))}</TableCell>
                    <TableCell className="text-right">
                      {centsToCurrency(cents(field.discount))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {centsToCurrency(netOf(field))}
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
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Total dos produtos</span>
                <span className="font-medium">{centsToCurrency(productsTotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Total da nota</span>
                <span className="font-semibold">{centsToCurrency(noteTotal)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
