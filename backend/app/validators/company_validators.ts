import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Companies module.
 *
 * All address/contact/registration fields are optional — the only required
 * field for creation is `legalName`. Documents that carry a mask in the UI
 * (`taxId`, `zipCode`, `phone`) are validated as raw digits.
 */

const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'email': 'E-mail inválido.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',
  'enum': 'Valor inválido.',
  'legalName.minLength': 'Razão social deve ter ao menos {{ min }} caracteres.',
  'taxId.regex': 'CNPJ deve ter 14 dígitos.',
  'zipCode.regex': 'CEP deve ter 8 dígitos.',
  'state.enum': 'UF inválida.',
  'phone.regex': 'Fone deve ter 10 ou 11 dígitos.',
  'email.email': 'E-mail inválido.',
})

export const createCompanyValidator = vine.compile(
  vine.object({
      legalName: vine.string().trim().minLength(2).maxLength(180),
      tradeName: vine.string().trim().maxLength(180).optional(),
      taxId: vine
        .string()
        .trim()
        .regex(/^\d{14}$/)
        .optional(),
      stateRegistration: vine.string().trim().maxLength(30).optional(),
      municipalRegistration: vine.string().trim().maxLength(30).optional(),
      address: vine.string().trim().maxLength(180).optional(),
      addressNumber: vine.string().trim().maxLength(20).optional(),
      neighborhood: vine.string().trim().maxLength(120).optional(),
      city: vine.string().trim().maxLength(120).optional(),
      zipCode: vine
        .string()
        .trim()
        .regex(/^\d{8}$/)
        .optional(),
      state: vine.enum(BRAZILIAN_STATES).optional(),
      phone: vine
        .string()
        .trim()
        .regex(/^\d{10,11}$/)
        .optional(),
      email: vine.string().trim().email().maxLength(180).optional(),
      slug: vine.string().trim().maxLength(80).optional(),
      isActive: vine.boolean().optional(),
      removeLogo: vine.boolean().optional(),
    })
)
createCompanyValidator.messagesProvider = messages

export const updateCompanyValidator = vine.compile(
  vine.object({
    legalName: vine.string().trim().minLength(2).maxLength(180).optional(),
    tradeName: vine.string().trim().maxLength(180).optional(),
    taxId: vine
      .string()
      .trim()
      .regex(/^\d{14}$/)
      .optional(),
    stateRegistration: vine.string().trim().maxLength(30).optional(),
    municipalRegistration: vine.string().trim().maxLength(30).optional(),
    address: vine.string().trim().maxLength(180).optional(),
    addressNumber: vine.string().trim().maxLength(20).optional(),
    neighborhood: vine.string().trim().maxLength(120).optional(),
    city: vine.string().trim().maxLength(120).optional(),
    zipCode: vine
      .string()
      .trim()
      .regex(/^\d{8}$/)
      .optional(),
    state: vine.enum(BRAZILIAN_STATES).optional(),
    phone: vine
      .string()
      .trim()
      .regex(/^\d{10,11}$/)
      .optional(),
    email: vine.string().trim().email().maxLength(180).optional(),
    isActive: vine.boolean().optional(),
    removeLogo: vine.boolean().optional(),
  })
)
updateCompanyValidator.messagesProvider = messages
