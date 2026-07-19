import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Payables module.
 *
 * **`status` and `paidAmount` are absent on purpose.** They are results, not
 * input: `paidAmount` is moved by the settlement module and `status` is derived
 * by `PayableService.recomputeStatus()`. VineJS drops unknown keys, so a payload
 * carrying `status: 'paid'` is silently ignored rather than rejected.
 *
 * Cross-field rules (`discount <= amount`, `dueDate >= issueDate`) live in the
 * service — they need more than one field to decide.
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'number': 'Deve ser um número.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',

  'documentNumber.required': 'Número do título é obrigatório.',
  'documentNumber.minLength': 'Número do título é obrigatório.',
  'documentNumber.maxLength': 'Número do título deve ter no máximo 20 caracteres.',

  'installment.min': 'Ordem deve ser no mínimo 1.',
  'installment.max': 'Ordem deve ser no máximo 999.',
  'installment.required': 'Ordem é obrigatória.',

  'supplierId.required': 'Selecione um fornecedor.',
  'supplierId.min': 'Selecione um fornecedor.',

  'issueDate.required': 'Data de emissão é obrigatória.',
  'issueDate.date': 'Data de emissão inválida.',
  'dueDate.required': 'Data de vencimento é obrigatória.',
  'dueDate.date': 'Data de vencimento inválida.',

  'amount.required': 'Valor do título é obrigatório.',
  'amount.min': 'Valor do título deve ser maior que zero.',
  'discount.min': 'Desconto não pode ser negativo.',
  'fine.min': 'Multa não pode ser negativa.',
  'interest.min': 'Juros não podem ser negativos.',

  'notes.maxLength': 'Observação deve ter no máximo 1000 caracteres.',
})

/** `YYYY-MM-DD` — the format `<input type="date">` submits. */
const DATE_FORMAT = { formats: ['YYYY-MM-DD'] }

export const createPayableValidator = vine.compile(
  vine.object({
    documentNumber: vine.string().trim().minLength(1).maxLength(20),
    installment: vine.number().withoutDecimals().min(1).max(999).optional(),
    supplierId: vine.number().withoutDecimals().min(1),
    issueDate: vine.date(DATE_FORMAT),
    dueDate: vine.date(DATE_FORMAT),
    // `min(0.01)` instead of `positive()`: money with 2 decimals, so the
    // smallest valid title is one cent.
    amount: vine.number().min(0.01),
    discount: vine.number().min(0).optional(),
    fine: vine.number().min(0).optional(),
    interest: vine.number().min(0).optional(),
    notes: vine.string().trim().maxLength(1000).optional(),
  })
)
createPayableValidator.messagesProvider = messages

export const updatePayableValidator = vine.compile(
  vine.object({
    documentNumber: vine.string().trim().minLength(1).maxLength(20).optional(),
    installment: vine.number().withoutDecimals().min(1).max(999).optional(),
    supplierId: vine.number().withoutDecimals().min(1).optional(),
    issueDate: vine.date(DATE_FORMAT).optional(),
    dueDate: vine.date(DATE_FORMAT).optional(),
    amount: vine.number().min(0.01).optional(),
    discount: vine.number().min(0).optional(),
    fine: vine.number().min(0).optional(),
    interest: vine.number().min(0).optional(),
    notes: vine.string().trim().maxLength(1000).optional(),
  })
)
updatePayableValidator.messagesProvider = messages
