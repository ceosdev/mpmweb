import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Payment Types module. Description is trimmed and must
 * be at least 1 character; there is no uniqueness rule.
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',
  'description.minLength': 'Descrição é obrigatória.',
  'description.required': 'Descrição é obrigatória.',
})

export const createPaymentTypeValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120),
    isActive: vine.boolean().optional(),
  })
)
createPaymentTypeValidator.messagesProvider = messages

export const updatePaymentTypeValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120).optional(),
    isActive: vine.boolean().optional(),
  })
)
updatePaymentTypeValidator.messagesProvider = messages
