import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Employees module.
 *
 * Every field but `name` is `.nullable().optional()`: the body parser turns
 * `""` into `null`, and keeping that `null` is what lets an edit **clear** a
 * field (absent = untouched, `null` = cleared). `taxId` accepts the masked
 * CPF too — the service strips it to digits and checks the checksum, so the
 * message can be the spec's "CPF inválido.".
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',
  'email': 'E-mail inválido.',
  'date': 'Data inválida.',
  'boolean': 'Valor inválido.',
  'name.minLength': 'Nome é obrigatório.',
  'name.required': 'Nome é obrigatório.',
  'zipCode.regex': 'CEP deve ter 8 dígitos.',
  'phone.regex': 'Telefone deve ter 10 ou 11 dígitos.',
  'mobile.regex': 'Celular deve ter 10 ou 11 dígitos.',
})

const optionalText = (max: number) => vine.string().trim().maxLength(max).nullable().optional()
const optionalDate = () => vine.date({ formats: ['YYYY-MM-DD'] }).nullable().optional()

const fields = {
  roleTitle: optionalText(80),
  birthDate: optionalDate(),
  taxId: optionalText(14),
  idNumber: optionalText(20),
  workCard: optionalText(30),
  pis: optionalText(20),
  driverLicense: optionalText(20),
  address: optionalText(160),
  addressNumber: optionalText(20),
  addressComplement: optionalText(80),
  neighborhood: optionalText(80),
  city: optionalText(80),
  zipCode: vine
    .string()
    .trim()
    .regex(/^\d{8}$/)
    .nullable()
    .optional(),
  phone: vine
    .string()
    .trim()
    .regex(/^\d{10,11}$/)
    .nullable()
    .optional(),
  mobile: vine
    .string()
    .trim()
    .regex(/^\d{10,11}$/)
    .nullable()
    .optional(),
  email: vine.string().trim().email().maxLength(160).nullable().optional(),
  hiredAt: optionalDate(),
  terminatedAt: optionalDate(),
  isActive: vine.boolean().optional(),
}

export const createEmployeeValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    ...fields,
  })
)
createEmployeeValidator.messagesProvider = messages

export const updateEmployeeValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120).optional(),
    ...fields,
  })
)
updateEmployeeValidator.messagesProvider = messages
