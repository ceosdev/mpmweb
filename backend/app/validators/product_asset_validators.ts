import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Product assets module.
 *
 * Note: `productId` does NOT come from the request body — it is read from the
 * URL path. Existence + tenant ownership of the parent product (and that it is
 * a `fixed_asset`), plus the brand / model FKs and the model↔brand consistency,
 * are enforced in the service layer (so messages can be specific).
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'number': 'Deve ser um número.',
  'boolean': 'Valor inválido.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',
  'enum': 'Valor inválido.',
  'description.minLength': 'Descrição é obrigatória.',
  'description.required': 'Descrição é obrigatória.',
  'situation.enum': 'Situação inválida.',
})

const SITUATIONS = ['available', 'allocated', 'sold'] as const

export const createProductAssetValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(160),
    assetCode: vine.string().trim().maxLength(60).optional().nullable(),
    brandId: vine.number().positive().optional().nullable(),
    brandModelId: vine.number().positive().optional().nullable(),
    manufactureYear: vine.string().trim().maxLength(4).optional().nullable(),
    btu: vine.string().trim().maxLength(20).optional().nullable(),
    situation: vine.enum(SITUATIONS).optional(),
    equipmentExists: vine.boolean().optional(),
    notes: vine.string().trim().optional().nullable(),
  })
)
createProductAssetValidator.messagesProvider = messages

export const updateProductAssetValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(160).optional(),
    assetCode: vine.string().trim().maxLength(60).optional().nullable(),
    brandId: vine.number().positive().optional().nullable(),
    brandModelId: vine.number().positive().optional().nullable(),
    manufactureYear: vine.string().trim().maxLength(4).optional().nullable(),
    btu: vine.string().trim().maxLength(20).optional().nullable(),
    situation: vine.enum(SITUATIONS).optional(),
    equipmentExists: vine.boolean().optional(),
    notes: vine.string().trim().optional().nullable(),
  })
)
updateProductAssetValidator.messagesProvider = messages
