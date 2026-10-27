import { z } from 'zod'
import { maskQuantity, parseQuantity } from '@/lib/masks'
import type {
  GoodsExit,
  GoodsExitConsumerType,
  GoodsExitPayload,
  GoodsExitType,
  ProductType,
} from '@/types/api'

/**
 * Item do array `items` do form. `quantity` guarda a **string mascarada pt-BR**
 * ("1.234,5"); o payload a converte com `parseQuantity` (texto puro, sem
 * `Number`). `costPrice` é a string decimal do custo (lookup ou foto do item
 * salvo; `null` = sem custo, conta como 0 no total).
 */
export interface GoodsExitItemFormValue {
  productId: number
  productDescription: string
  productType: ProductType | null
  unitOfMeasure: string
  quantity: string
  costPrice: string | null
}

const itemSchema = z.object({
  productId: z.number().int().positive(),
  productDescription: z.string(),
  productType: z.enum(['consumable', 'fixed_asset', 'tool']).nullable(),
  unitOfMeasure: z.string(),
  quantity: z.string(),
  costPrice: z.string().nullable(),
}) satisfies z.ZodType<GoodsExitItemFormValue>

export const schema = z
  .object({
    exitType: z.enum(['normal', 'tool']),
    consumerType: z.enum(['asset', 'employee']),
    /** Id do ativo ou do funcionário, conforme `consumerType`; 0 = não escolhido. */
    consumerId: z.number().int(),
    notes: z.string().trim().max(2000, 'Deve ter no máximo 2000 caracteres.'),
    items: z.array(itemSchema),
  })
  .superRefine((values, ctx) => {
    if (values.consumerId > 0) return
    ctx.addIssue({
      code: 'custom',
      path: ['consumerId'],
      message: values.consumerType === 'asset' ? 'Selecione o ativo.' : 'Selecione o funcionário.',
    })
  })

export type FormValues = z.infer<typeof schema>

export function emptyValues(): FormValues {
  return { exitType: 'normal', consumerType: 'employee', consumerId: 0, notes: '', items: [] }
}

/** String decimal da API ("1234.5000") → string mascarada pt-BR ("1.234,5"). */
export function quantityToMask(value: string): string {
  const [int, frac = ''] = value.split('.')
  const significant = frac.slice(0, 4).replace(/0+$/, '')
  return maskQuantity(significant ? `${int},${significant}` : int)
}

export function toFormValues(exit: GoodsExit): FormValues {
  const type: GoodsExitConsumerType = exit.consumerType
  return {
    exitType: exit.exitType,
    consumerType: type,
    consumerId: (type === 'asset' ? exit.productAssetId : exit.employeeId) ?? 0,
    notes: exit.notes ?? '',
    items: (exit.items ?? []).map((item) => ({
      productId: item.productId,
      productDescription: item.productDescription ?? '',
      productType: item.productType,
      unitOfMeasure: item.unitOfMeasure ?? '',
      quantity: quantityToMask(item.requestedQuantity),
      costPrice: item.unitCost,
    })),
  }
}

export function toGoodsExitPayload(values: FormValues): GoodsExitPayload {
  const isAsset = values.consumerType === 'asset'
  return {
    exitType: values.exitType as GoodsExitType,
    consumerType: values.consumerType,
    productAssetId: isAsset ? values.consumerId : undefined,
    employeeId: isAsset ? undefined : values.consumerId,
    notes: values.notes.trim() || undefined,
    items: values.items.map((item) => ({
      productId: item.productId,
      requestedQuantity: parseQuantity(item.quantity) ?? '0',
    })),
  }
}
