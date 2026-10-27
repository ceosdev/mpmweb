import { z } from 'zod'
import {
  centsToReais,
  maskQuantity,
  parseQuantity,
  parseUnitPrice,
  reaisToCents,
  unitPriceToMask,
} from '@/lib/masks'
import { todayIso } from '@/lib/format'
import type { GoodsEntry, GoodsEntryPayload, ProductType } from '@/types/api'

/**
 * Um item do array `items` do form pai. `quantity` e `unitPrice` guardam a
 * **string mascarada pt-BR** ("1.234,5678"); o payload as converte com
 * `parseQuantity`/`parseUnitPrice` (string pura, sem `Number`). `discount` é
 * string de **centavos**, como os demais campos monetários. Os campos de
 * produto são capturados ao adicionar a linha — a tabela exibe texto estático.
 */
export interface GoodsEntryItemFormValue {
  productId: number
  productDescription: string
  productType: ProductType | null
  unitOfMeasure: string
  quantity: string
  unitPrice: string
  discount: string
}

/**
 * Preço do lookup/da API ("3.4566666667") → máscara do campo Preço
 * (`R$ 3,46`, 2 casas, padrão brasileiro); '' quando `null`.
 */
export function priceToMask(value: string | null): string {
  return unitPriceToMask(value)
}

// `satisfies`, não uma anotação `z.ZodType<T>`: preserva a forma inferida pelo
// zod (necessária para o `zodResolver` tipar o array corretamente) e ainda
// verifica que ela bate com `GoodsEntryItemFormValue`.
const itemSchema = z.object({
  productId: z.number().int().positive(),
  productDescription: z.string(),
  productType: z.enum(['consumable', 'fixed_asset', 'tool']).nullable(),
  unitOfMeasure: z.string(),
  quantity: z.string(),
  unitPrice: z.string(),
  discount: z.string(),
}) satisfies z.ZodType<GoodsEntryItemFormValue>

/**
 * Campos monetários guardados como **string de centavos**; convertidos com
 * `centsToReais`/`reaisToCents` (`lib/masks.ts`) no submit e ao popular.
 */
export const schema = z.object({
  documentTypeId: z
    .number({ error: 'Selecione o tipo de documento.' })
    .int()
    .positive('Selecione o tipo de documento.'),
  documentNumber: z
    .string()
    .trim()
    .min(1, 'Número do documento é obrigatório.')
    .max(20, 'Deve ter no máximo 20 caracteres.'),
  series: z.string().trim().max(10, 'Deve ter no máximo 10 caracteres.'),
  subSeries: z.string().trim().max(10, 'Deve ter no máximo 10 caracteres.'),
  issueDate: z.string().min(1, 'Data de emissão é obrigatória.'),
  supplierId: z
    .number({ error: 'Selecione um fornecedor.' })
    .int()
    .positive('Selecione um fornecedor.'),
  discount: z.string(),
  icmsSt: z.string(),
  ipi: z.string(),
  freight: z.string(),
  insurance: z.string(),
  otherExpenses: z.string(),
  paymentTypeId: z
    .number({ error: 'Selecione o tipo de pagamento.' })
    .int()
    .positive('Selecione o tipo de pagamento.'),
  installmentCount: z
    .number({ error: 'Informe a quantidade de parcelas.' })
    .int('Deve ser um número inteiro.')
    .min(1, 'Deve ser no mínimo 1.')
    .max(999, 'Deve ser no máximo 999.'),
  firstDueDate: z.string().min(1, '1º vencimento é obrigatório.'),
  items: z.array(itemSchema),
})

export type FormValues = z.infer<typeof schema>

export function emptyValues(): FormValues {
  const today = todayIso()
  return {
    documentTypeId: 0,
    documentNumber: '',
    series: '',
    subSeries: '',
    issueDate: today,
    supplierId: 0,
    discount: '',
    icmsSt: '',
    ipi: '',
    freight: '',
    insurance: '',
    otherExpenses: '',
    paymentTypeId: 0,
    installmentCount: 1,
    firstDueDate: today,
    items: [],
  }
}

/** String decimal da API ("1234.5000") → string mascarada pt-BR ("1.234,50"). */
function quantityToMask(value: string): string {
  const [int, frac = ''] = value.split('.')
  const significant = frac.slice(0, 4).replace(/0+$/, '')
  return maskQuantity(significant ? `${int},${significant}` : int)
}

export function toFormValues(entry: GoodsEntry): FormValues {
  return {
    documentTypeId: entry.documentTypeId,
    documentNumber: entry.documentNumber,
    series: entry.series ?? '',
    subSeries: entry.subSeries ?? '',
    issueDate: entry.issueDate,
    supplierId: entry.supplierId,
    discount: reaisToCents(entry.discount),
    icmsSt: reaisToCents(entry.icmsSt),
    ipi: reaisToCents(entry.ipi),
    freight: reaisToCents(entry.freight),
    insurance: reaisToCents(entry.insurance),
    otherExpenses: reaisToCents(entry.otherExpenses),
    paymentTypeId: entry.paymentTypeId,
    installmentCount: entry.installmentCount,
    firstDueDate: entry.firstDueDate,
    items: (entry.items ?? []).map((item) => ({
      productId: item.productId,
      productDescription: item.productDescription ?? '',
      productType: item.productType,
      unitOfMeasure: item.unitOfMeasure ?? '',
      quantity: quantityToMask(item.quantity),
      unitPrice: priceToMask(item.unitPrice),
      discount: reaisToCents(item.discount),
    })),
  }
}

/**
 * Valores do form → payload da API. Pura (exportada para verificação).
 * Quantidade e preço saem como **string decimal com ponto**, convertidas só por
 * manipulação de texto — nunca `Number` (10 casas não cabem num double).
 */
export function toGoodsEntryPayload(values: FormValues): GoodsEntryPayload {
  return {
    documentTypeId: values.documentTypeId,
    documentNumber: values.documentNumber.trim(),
    series: values.series.trim() || undefined,
    subSeries: values.subSeries.trim() || undefined,
    issueDate: values.issueDate,
    supplierId: values.supplierId,
    discount: centsToReais(values.discount),
    icmsSt: centsToReais(values.icmsSt),
    ipi: centsToReais(values.ipi),
    freight: centsToReais(values.freight),
    insurance: centsToReais(values.insurance),
    otherExpenses: centsToReais(values.otherExpenses),
    paymentTypeId: values.paymentTypeId,
    installmentCount: values.installmentCount,
    firstDueDate: values.firstDueDate,
    items: values.items.map((item) => ({
      productId: item.productId,
      quantity: parseQuantity(item.quantity) ?? '0',
      unitPrice: parseUnitPrice(item.unitPrice) ?? '0',
      discount: centsToReais(item.discount),
    })),
  }
}

