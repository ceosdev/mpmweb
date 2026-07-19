import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the receivable settlements (baixas) module. **Mirror of the
 * payable settlement validators.**
 *
 * The balance rule (Σ das baixas ≤ total do título) lives in the service — it
 * depends on the receivable's state, not on the payload alone.
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

  'receivableIds.required': 'Selecione ao menos um título.',
  'receivableIds.array.minLength': 'Selecione ao menos um título.',
  'receivableIds.notEmpty': 'Selecione ao menos um título.',

  'amount.required': 'Valor recebido é obrigatório.',
  'amount.min': 'Valor recebido deve ser maior que zero.',

  'documentNumber.maxLength': 'Número do documento deve ter no máximo 30 caracteres.',
  'notes.maxLength': 'Observação deve ter no máximo 1000 caracteres.',
})

/** `YYYY-MM-DD` — the format `<input type="date">` submits. */
const DATE_FORMAT = { formats: ['YYYY-MM-DD'] }

export const createReceivableSettlementValidator = vine.compile(
  vine.object({
    settlementDate: vine.date(DATE_FORMAT),
    paymentTypeId: vine.number().withoutDecimals().min(1),
    // `min(0.01)`: money with 2 decimals, so the smallest valid baixa is one cent.
    amount: vine.number().min(0.01),
    documentNumber: vine.string().trim().maxLength(30).optional(),
    notes: vine.string().trim().maxLength(1000).optional(),
  })
)
createReceivableSettlementValidator.messagesProvider = messages

export const updateReceivableSettlementValidator = vine.compile(
  vine.object({
    settlementDate: vine.date(DATE_FORMAT).optional(),
    paymentTypeId: vine.number().withoutDecimals().min(1).optional(),
    amount: vine.number().min(0.01).optional(),
    documentNumber: vine.string().trim().maxLength(30).optional(),
    notes: vine.string().trim().maxLength(1000).optional(),
  })
)
updateReceivableSettlementValidator.messagesProvider = messages

/**
 * Recebimento em lote: uma forma de pagamento aplicada a vários títulos. O
 * cliente envia só os ids e o tipo — valor (saldo) e data (hoje) são derivados no
 * service, dentro da transação. Ids duplicados são deduplicados lá.
 */
export const batchReceivableSettlementValidator = vine.compile(
  vine.object({
    receivableIds: vine.array(vine.number().withoutDecimals().min(1)).minLength(1),
    paymentTypeId: vine.number().withoutDecimals().min(1),
  })
)
batchReceivableSettlementValidator.messagesProvider = messages
