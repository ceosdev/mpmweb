import vine, { SimpleMessagesProvider } from '@vinejs/vine'

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',
  'description.minLength': 'Descrição é obrigatória.',
  'description.required': 'Descrição é obrigatória.',
})

export const createDocumentTypeValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120),
    isActive: vine.boolean().optional(),
  })
)
createDocumentTypeValidator.messagesProvider = messages

export const updateDocumentTypeValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120).optional(),
    isActive: vine.boolean().optional(),
  })
)
updateDocumentTypeValidator.messagesProvider = messages
