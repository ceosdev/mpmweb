import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Suppliers module.
 *
 * `taxId`, `zipCode`, `phone` and `mobile` are validated as raw digits — the
 * frontend strips the mask before submitting. The CPF/CNPJ checksum is
 * verified in the service layer (business rule, returns 422 with a friendly
 * message in pt-BR).
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',
  'enum': 'Valor inválido.',
  'taxId.regex': 'CPF/CNPJ deve ter 11 ou 14 dígitos.',
  'taxId.required': 'CPF/CNPJ é obrigatório.',
  'name.minLength': 'Nome é obrigatório.',
  'name.required': 'Nome é obrigatório.',
  'type.enum': 'Tipo inválido.',
  'type.required': 'Tipo é obrigatório.',
  'zipCode.regex': 'CEP deve ter 8 dígitos.',
  'phone.regex': 'Telefone deve ter 10 ou 11 dígitos.',
  'mobile.regex': 'Celular deve ter 10 ou 11 dígitos.',
})

const SUPPLIER_TYPES = ['goods', 'service'] as const

export const createSupplierValidator = vine.compile(
  vine.object({
    taxId: vine
      .string()
      .trim()
      .regex(/^(\d{11}|\d{14})$/),
    name: vine.string().trim().minLength(1).maxLength(120),
    type: vine.enum(SUPPLIER_TYPES),
    address: vine.string().trim().maxLength(160).optional(),
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
    contactName: vine.string().trim().maxLength(120).optional(),
    isActive: vine.boolean().optional(),
  })
)
createSupplierValidator.messagesProvider = messages

export const updateSupplierValidator = vine.compile(
  vine.object({
    taxId: vine
      .string()
      .trim()
      .regex(/^(\d{11}|\d{14})$/)
      .optional(),
    name: vine.string().trim().minLength(1).maxLength(120).optional(),
    type: vine.enum(SUPPLIER_TYPES).optional(),
    address: vine.string().trim().maxLength(160).optional(),
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
    contactName: vine.string().trim().maxLength(120).optional(),
    isActive: vine.boolean().optional(),
  })
)
updateSupplierValidator.messagesProvider = messages
