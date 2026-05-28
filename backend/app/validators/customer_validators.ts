import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Customers module.
 *
 * `taxId`, `zipCode`, `phone` and `mobile` are validated as raw digits — the
 * frontend strips the mask before submitting. The CPF/CNPJ checksum **and**
 * the cross-check against `type` (PF=11 digits, PJ=14) are enforced in the
 * service layer so the error messages can be specific.
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',
  'enum': 'Valor inválido.',
  'email': 'E-mail inválido.',
  'date': 'Data inválida.',
  'taxId.regex': 'CPF/CNPJ deve ter 11 ou 14 dígitos.',
  'taxId.required': 'CPF/CNPJ é obrigatório.',
  'legalName.minLength': 'Nome / razão social é obrigatório.',
  'legalName.required': 'Nome / razão social é obrigatório.',
  'type.enum': 'Tipo inválido.',
  'type.required': 'Tipo é obrigatório.',
  'zipCode.regex': 'CEP deve ter 8 dígitos.',
  'phone.regex': 'Telefone deve ter 10 ou 11 dígitos.',
  'mobile.regex': 'Celular deve ter 10 ou 11 dígitos.',
})

const CUSTOMER_TYPES = ['individual', 'company'] as const

export const createCustomerValidator = vine.compile(
  vine.object({
    type: vine.enum(CUSTOMER_TYPES),
    legalName: vine.string().trim().minLength(1).maxLength(160),
    tradeName: vine.string().trim().maxLength(160).optional(),
    taxId: vine
      .string()
      .trim()
      .regex(/^(\d{11}|\d{14})$/),
    address: vine.string().trim().maxLength(160).optional(),
    addressNumber: vine.string().trim().maxLength(20).optional(),
    addressComplement: vine.string().trim().maxLength(80).optional(),
    neighborhood: vine.string().trim().maxLength(80).optional(),
    city: vine.string().trim().maxLength(80).optional(),
    zipCode: vine
      .string()
      .trim()
      .regex(/^\d{8}$/)
      .optional(),
    phone: vine
      .string()
      .trim()
      .regex(/^\d{10,11}$/)
      .optional(),
    mobile: vine
      .string()
      .trim()
      .regex(/^\d{10,11}$/)
      .optional(),
    email: vine.string().trim().email().maxLength(160).optional(),
    customerSince: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    contactName: vine.string().trim().maxLength(120).optional(),
    isActive: vine.boolean().optional(),
    isInternal: vine.boolean().optional(),
  })
)
createCustomerValidator.messagesProvider = messages

export const updateCustomerValidator = vine.compile(
  vine.object({
    type: vine.enum(CUSTOMER_TYPES).optional(),
    legalName: vine.string().trim().minLength(1).maxLength(160).optional(),
    tradeName: vine.string().trim().maxLength(160).optional(),
    taxId: vine
      .string()
      .trim()
      .regex(/^(\d{11}|\d{14})$/)
      .optional(),
    address: vine.string().trim().maxLength(160).optional(),
    addressNumber: vine.string().trim().maxLength(20).optional(),
    addressComplement: vine.string().trim().maxLength(80).optional(),
    neighborhood: vine.string().trim().maxLength(80).optional(),
    city: vine.string().trim().maxLength(80).optional(),
    zipCode: vine
      .string()
      .trim()
      .regex(/^\d{8}$/)
      .optional(),
    phone: vine
      .string()
      .trim()
      .regex(/^\d{10,11}$/)
      .optional(),
    mobile: vine
      .string()
      .trim()
      .regex(/^\d{10,11}$/)
      .optional(),
    email: vine.string().trim().email().maxLength(160).optional(),
    customerSince: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    contactName: vine.string().trim().maxLength(120).optional(),
    isActive: vine.boolean().optional(),
    isInternal: vine.boolean().optional(),
  })
)
updateCustomerValidator.messagesProvider = messages
