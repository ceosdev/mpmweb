import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import { TAX_WITHHOLDINGS } from '#models/service_entry'

/**
 * Validators for the Service Entries module.
 *
 * **`status`, `finalizedAt` and `operationDate` are absent on purpose.** They
 * are results, not input: the first two move only through the finalize/cancel
 * actions, and `operationDate` is stamped by the service with the application's
 * "today". VineJS drops unknown keys, so a payload carrying them is silently
 * ignored rather than rejected.
 *
 * Cross-field rules (discount <= total, base > 0, firstDueDate >= issueDate)
 * live in the service — they need more than one field, or the persisted state,
 * to decide.
 *
 * **Create and update share the exact same shape** — unlike payables, the
 * update here is *not* `Partial`. Items are replaced in block on every write,
 * so both validators compile from the same `serviceEntryFields` object instead
 * of duplicating it.
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
  'taxWithholding.enum': 'Selecione quem retém o imposto.',
  'iss.min': 'ISS não pode ser negativo.',
  'pis.min': 'PIS não pode ser negativo.',
  'cofins.min': 'COFINS não pode ser negativo.',
  'inss.min': 'INSS não pode ser negativo.',
  'irrf.min': 'IRRF não pode ser negativo.',
  'csll.min': 'CSLL não pode ser negativo.',

  'paymentTypeId.required': 'Selecione o tipo de pagamento.',
  'paymentTypeId.min': 'Selecione o tipo de pagamento.',

  'installmentCount.required': 'Quantidade de parcelas é obrigatória.',
  'installmentCount.min': 'Quantidade de parcelas deve ser no mínimo 1.',
  'installmentCount.max': 'Quantidade de parcelas deve ser no máximo 999.',

  'firstDueDate.required': 'Primeiro vencimento é obrigatório.',
  'firstDueDate.date': 'Primeiro vencimento inválido.',

  'items.required': 'Adicione ao menos um serviço.',
  'items.minLength': 'Adicione ao menos um serviço.',
  'items.*.serviceId.required': 'Selecione o serviço.',
  'items.*.serviceId.min': 'Selecione o serviço.',
  'items.*.quantity.min': 'Quantidade deve ser no mínimo 1.',
  'items.*.unitPrice.min': 'Valor do serviço deve ser maior que zero.',
  'items.*.discount.min': 'Desconto do serviço não pode ser negativo.',
})

/** `YYYY-MM-DD` — the format `<input type="date">` submits. */
const DATE_FORMAT = { formats: ['YYYY-MM-DD'] }

const itemSchema = vine.object({
  serviceId: vine.number().withoutDecimals().min(1),
  quantity: vine.number().withoutDecimals().min(1),
  // `min(0.01)`: money with 2 decimals, so the smallest valid price is one cent.
  unitPrice: vine.number().min(0.01),
  discount: vine.number().min(0).optional(),
})

const taxFields = {
  discount: vine.number().min(0).optional(),
  taxWithholding: vine.enum(TAX_WITHHOLDINGS).optional(),
  iss: vine.number().min(0).optional(),
  pis: vine.number().min(0).optional(),
  cofins: vine.number().min(0).optional(),
  inss: vine.number().min(0).optional(),
  irrf: vine.number().min(0).optional(),
  csll: vine.number().min(0).optional(),
}

/** Shared by create and update — the update is a full replace, not a `Partial`. */
const serviceEntryFields = {
  documentTypeId: vine.number().withoutDecimals().min(1),
  documentNumber: vine.string().trim().minLength(1).maxLength(20),
  series: vine.string().trim().maxLength(10).optional(),
  subSeries: vine.string().trim().maxLength(10).optional(),
  issueDate: vine.date(DATE_FORMAT),
  supplierId: vine.number().withoutDecimals().min(1),
  ...taxFields,
  paymentTypeId: vine.number().withoutDecimals().min(1),
  installmentCount: vine.number().withoutDecimals().min(1).max(999),
  firstDueDate: vine.date(DATE_FORMAT),
  items: vine.array(itemSchema).minLength(1),
}

export const createServiceEntryValidator = vine.compile(vine.object(serviceEntryFields))
createServiceEntryValidator.messagesProvider = messages

export const updateServiceEntryValidator = vine.compile(vine.object(serviceEntryFields))
updateServiceEntryValidator.messagesProvider = messages
