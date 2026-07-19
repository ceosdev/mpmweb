import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the payable settlements (baixas) module.
 *
 * The balance rule (Σ das baixas ≤ total do título) lives in the service — it
 * depends on the payable's state, not on the payload alone.
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'number': 'Deve ser um número.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',

  'settlementDate.required': 'Data da baixa é obrigatória.',
  'settlementDate.date': 'Data da baixa inválida.',

  'paymentTypeId.required': 'Selecione o tipo de pagamento.',
  'paymentTypeId.min': 'Selecione o tipo de pagamento.',

  'payableIds.required': 'Selecione ao menos um título.',
  'payableIds.array.minLength': 'Selecione ao menos um título.',
  'payableIds.notEmpty': 'Selecione ao menos um título.',

  'amount.required': 'Valor pago é obrigatório.',
  'amount.min': 'Valor pago deve ser maior que zero.',

  'documentNumber.maxLength': 'Número do documento deve ter no máximo 30 caracteres.',
  'notes.maxLength': 'Observação deve ter no máximo 1000 caracteres.',
})

/** `YYYY-MM-DD` — the format `<input type="date">` submits. */
const DATE_FORMAT = { formats: ['YYYY-MM-DD'] }

export const createPayableSettlementValidator = vine.compile(
  vine.object({
    settlementDate: vine.date(DATE_FORMAT),
    paymentTypeId: vine.number().withoutDecimals().min(1),
    // `min(0.01)`: money with 2 decimals, so the smallest valid baixa is one cent.
    amount: vine.number().min(0.01),
    documentNumber: vine.string().trim().maxLength(30).optional(),
    notes: vine.string().trim().maxLength(1000).optional(),
  })
)
createPayableSettlementValidator.messagesProvider = messages

export const updatePayableSettlementValidator = vine.compile(
  vine.object({
    settlementDate: vine.date(DATE_FORMAT).optional(),
    paymentTypeId: vine.number().withoutDecimals().min(1).optional(),
    amount: vine.number().min(0.01).optional(),
    documentNumber: vine.string().trim().maxLength(30).optional(),
    notes: vine.string().trim().maxLength(1000).optional(),
  })
)
updatePayableSettlementValidator.messagesProvider = messages

/**
 * Pagamento em lote: uma forma de pagamento aplicada a vários títulos. O cliente
 * envia só os ids e o tipo — valor (saldo) e data (hoje) são derivados no
 * service, dentro da transação. Ids duplicados são deduplicados lá.
 */
export const batchPayableSettlementValidator = vine.compile(
  vine.object({
    payableIds: vine.array(vine.number().withoutDecimals().min(1)).minLength(1),
    paymentTypeId: vine.number().withoutDecimals().min(1),
  })
)
batchPayableSettlementValidator.messagesProvider = messages
