import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Services module.
 *
 * Existence + tenant ownership of `serviceGroupId` is enforced in the service
 * layer (so the error message can be specific). `suggestedValue` is a price in
 * reais (>= 0); the frontend sends it as a plain number.
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'number': 'Deve ser um número.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',
  'enum': 'Valor inválido.',
  'description.minLength': 'Descrição é obrigatória.',
  'description.required': 'Descrição é obrigatória.',
  'serviceGroupId.required': 'Grupo do serviço é obrigatório.',
  'serviceGroupId.number': 'Grupo do serviço inválido.',
  'type.enum': 'Tipo inválido.',
  'type.required': 'Tipo é obrigatório.',
  'suggestedValue.min': 'Valor sugerido não pode ser negativo.',
})

const SERVICE_TYPES = ['internal', 'third_party'] as const

export const createServiceValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120),
    serviceGroupId: vine.number().positive(),
    suggestedValue: vine.number().min(0).optional(),
    type: vine.enum(SERVICE_TYPES),
    notes: vine.string().trim().maxLength(1000).optional(),
    isActive: vine.boolean().optional(),
  })
)
createServiceValidator.messagesProvider = messages

export const updateServiceValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120).optional(),
    serviceGroupId: vine.number().positive().optional(),
    suggestedValue: vine.number().min(0).optional(),
    type: vine.enum(SERVICE_TYPES).optional(),
    notes: vine.string().trim().maxLength(1000).optional(),
    isActive: vine.boolean().optional(),
  })
)
updateServiceValidator.messagesProvider = messages
