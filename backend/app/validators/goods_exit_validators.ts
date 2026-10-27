import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Goods Exits module.
 *
 * **`status`, `operationDate`, `requestedByUserId`, `unitCost` and
 * `consumedQuantity` are absent on purpose** — they are results stamped by the
 * service/actions; VineJS drops unknown keys, so a payload carrying them is
 * silently ignored.
 *
 * `requestedQuantity` travels as a **decimal string** (regex, not
 * `vine.number()`); `> 0` needs the exact value and is checked in the service.
 * Create and update share the same shape — items are replaced in block.
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'number': 'Deve ser um número.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',

  'exitType.required': 'Selecione o tipo de saída.',
  'exitType.enum': 'Tipo de saída inválido.',
  'consumerType.required': 'Selecione o tipo de consumidor.',
  'consumerType.enum': 'Tipo de consumidor inválido.',
  'productAssetId.min': 'Selecione o ativo.',
  'employeeId.min': 'Selecione o funcionário.',
  'notes.maxLength': 'Observação deve ter no máximo 5000 caracteres.',

  'items.required': 'Adicione ao menos um produto.',
  'items.minLength': 'Adicione ao menos um produto.',
  'items.*.productId.required': 'Selecione o produto.',
  'items.*.productId.min': 'Selecione o produto.',
  'items.*.requestedQuantity.required': 'Informe a quantidade.',
  'items.*.requestedQuantity.regex': 'Quantidade inválida (até 4 casas decimais).',
})

const itemSchema = vine.object({
  productId: vine.number().withoutDecimals().min(1),
  requestedQuantity: vine.string().trim().regex(/^\d{1,11}(\.\d{1,4})?$/),
})

const goodsExitFields = {
  exitType: vine.enum(['normal', 'tool'] as const),
  consumerType: vine.enum(['asset', 'employee'] as const),
  productAssetId: vine.number().withoutDecimals().min(1).optional(),
  employeeId: vine.number().withoutDecimals().min(1).optional(),
  notes: vine.string().trim().maxLength(5000).optional(),
  items: vine.array(itemSchema).minLength(1),
}

export const createGoodsExitValidator = vine.compile(vine.object(goodsExitFields))
createGoodsExitValidator.messagesProvider = messages

export const updateGoodsExitValidator = vine.compile(vine.object(goodsExitFields))
updateGoodsExitValidator.messagesProvider = messages
