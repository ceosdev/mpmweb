import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Goods Entries module.
 *
 * **`status`, `finalizedAt`, `operationDate` and `stockEffect` are absent on
 * purpose.** They are results, not input: status/finalizedAt move only through
 * finalize/cancel, `operationDate` is stamped by the service with the
 * application's "today" and `stockEffect` is written by the finalization.
 * VineJS drops unknown keys, so a payload carrying them is silently ignored.
 *
 * `quantity` and `unitPrice` travel as **decimal strings** (regex, not
 * `vine.number()`): quantity has 4 places, price up to 10, and a JS `number`
 * would lose digits. `quantity > 0` needs the exact value, so it is checked in
 * the service via `toScaled`, together with the other cross-field rules.
 *
 * Create and update share the exact same shape — items are replaced in block.
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'number': 'Deve ser um número.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',

  'documentTypeId.required': 'Selecione o tipo de documento.',
  'documentTypeId.min': 'Selecione o tipo de documento.',

  'documentNumber.required': 'Número do documento é obrigatório.',
  'documentNumber.minLength': 'Número do documento é obrigatório.',
  'documentNumber.maxLength': 'Número do documento deve ter no máximo 20 caracteres.',

  'series.maxLength': 'Série deve ter no máximo 10 caracteres.',
  'subSeries.maxLength': 'Sub-série deve ter no máximo 10 caracteres.',

  'issueDate.required': 'Data de emissão é obrigatória.',
  'issueDate.date': 'Data de emissão inválida.',

  'supplierId.required': 'Selecione um fornecedor.',
  'supplierId.min': 'Selecione um fornecedor.',

  'discount.min': 'Desconto não pode ser negativo.',
  'icmsSt.min': 'ICMS ST não pode ser negativo.',
  'ipi.min': 'IPI não pode ser negativo.',
  'freight.min': 'Frete não pode ser negativo.',
  'insurance.min': 'Seguro não pode ser negativo.',
  'otherExpenses.min': 'Outras despesas não pode ser negativo.',

  'paymentTypeId.required': 'Selecione o tipo de pagamento.',
  'paymentTypeId.min': 'Selecione o tipo de pagamento.',

  'installmentCount.required': 'Quantidade de parcelas é obrigatória.',
  'installmentCount.min': 'Quantidade de parcelas deve ser no mínimo 1.',
  'installmentCount.max': 'Quantidade de parcelas deve ser no máximo 999.',

  'firstDueDate.required': 'Primeiro vencimento é obrigatório.',
  'firstDueDate.date': 'Primeiro vencimento inválido.',

  'items.required': 'Adicione ao menos um produto.',
  'items.minLength': 'Adicione ao menos um produto.',
  'items.*.productId.required': 'Selecione o produto.',
  'items.*.productId.min': 'Selecione o produto.',
  'items.*.quantity.required': 'Informe a quantidade.',
  'items.*.quantity.regex': 'Quantidade inválida (até 4 casas decimais).',
  'items.*.unitPrice.required': 'Informe o preço.',
  'items.*.unitPrice.regex': 'Preço inválido (até 10 casas decimais).',
  'items.*.discount.min': 'Desconto do produto não pode ser negativo.',

  'dueDates.required': 'Informe os vencimentos das parcelas.',
  'dueDates.array': 'Informe os vencimentos das parcelas.',
  'dueDates.minLength': 'Informe os vencimentos das parcelas.',
  'dueDates.*.required': 'Informe o vencimento da parcela.',
  'dueDates.*.date': 'Vencimento inválido.',
})

/** `YYYY-MM-DD` — the format `<input type="date">` submits. */
const DATE_FORMAT = { formats: ['YYYY-MM-DD'] }

const itemSchema = vine.object({
  productId: vine.number().withoutDecimals().min(1),
  quantity: vine.string().trim().regex(/^\d{1,11}(\.\d{1,4})?$/),
  unitPrice: vine.string().trim().regex(/^\d{1,10}(\.\d{1,10})?$/),
  discount: vine.number().min(0).optional(),
})

const moneyFields = {
  discount: vine.number().min(0).optional(),
  icmsSt: vine.number().min(0).optional(),
  ipi: vine.number().min(0).optional(),
  freight: vine.number().min(0).optional(),
  insurance: vine.number().min(0).optional(),
  otherExpenses: vine.number().min(0).optional(),
}

/** Shared by create and update — the update is a full replace, not a `Partial`. */
const goodsEntryFields = {
  documentTypeId: vine.number().withoutDecimals().min(1),
  documentNumber: vine.string().trim().minLength(1).maxLength(20),
  series: vine.string().trim().maxLength(10).optional(),
  subSeries: vine.string().trim().maxLength(10).optional(),
  issueDate: vine.date(DATE_FORMAT),
  supplierId: vine.number().withoutDecimals().min(1),
  ...moneyFields,
  paymentTypeId: vine.number().withoutDecimals().min(1),
  installmentCount: vine.number().withoutDecimals().min(1).max(999),
  firstDueDate: vine.date(DATE_FORMAT),
  items: vine.array(itemSchema).minLength(1),
}

export const createGoodsEntryValidator = vine.compile(vine.object(goodsEntryFields))
createGoodsEntryValidator.messagesProvider = messages

export const updateGoodsEntryValidator = vine.compile(vine.object(goodsEntryFields))
updateGoodsEntryValidator.messagesProvider = messages

/** Finalization: the effective due date of each installment, `YYYY-MM-DD`. */
export const finalizeGoodsEntryValidator = vine.compile(
  vine.object({
    dueDates: vine.array(vine.date(DATE_FORMAT)).minLength(1),
  })
)
finalizeGoodsEntryValidator.messagesProvider = messages
