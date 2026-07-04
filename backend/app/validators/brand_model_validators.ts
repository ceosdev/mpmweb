import vine, { SimpleMessagesProvider } from '@vinejs/vine'

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',
  'description.minLength': 'Descrição é obrigatória.',
  'description.required': 'Descrição é obrigatória.',
})

/**
 * Note: `brandId` does NOT come from the request body — it is read from the
 * URL path. Validators only cover the user-editable fields.
 */
export const createBrandModelValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120),
    isActive: vine.boolean().optional(),
  })
)
createBrandModelValidator.messagesProvider = messages

export const updateBrandModelValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120).optional(),
    isActive: vine.boolean().optional(),
  })
)
updateBrandModelValidator.messagesProvider = messages
