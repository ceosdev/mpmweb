import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the LDF Parameters module.
 *
 * Existence + tenant ownership of `expenseGroupId` is enforced in the service
 * layer (so the error message can be specific). The `code` shown in the UI is
 * the row `id` — never part of the payload.
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'number': 'Deve ser um número.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',
  'description.minLength': 'Descrição é obrigatória.',
  'description.required': 'Descrição é obrigatória.',
  'expenseGroupId.required': 'Grupo de despesa é obrigatório.',
  'expenseGroupId.number': 'Grupo de despesa inválido.',
})

export const createLdfParameterValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120),
    expenseGroupId: vine.number().positive(),
    isActive: vine.boolean().optional(),
  })
)
createLdfParameterValidator.messagesProvider = messages

export const updateLdfParameterValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120).optional(),
    expenseGroupId: vine.number().positive().optional(),
    isActive: vine.boolean().optional(),
  })
)
updateLdfParameterValidator.messagesProvider = messages
