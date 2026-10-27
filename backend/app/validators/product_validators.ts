import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Products module.
 *
 * Existence + tenant ownership of the FKs (group/subgroup/unit) and the
 * subgroup↔group consistency are enforced in the service layer (so messages can
 * be specific). Stock fields are governed by `controlsStock` at the service
 * layer too.
 *
 * Strategy A for stock immutability: `quantityInStock` is declared ONLY in the
 * create validator. The update validator omits it, so VineJS drops the key on
 * PUT and the balance stays unchanged.
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
  'type.required': 'Tipo é obrigatório.',
  'type.enum': 'Tipo inválido.',
  'minimumStock.min': 'Estoque mínimo não pode ser negativo.',
  'quantityInStock.min': 'Quantidade em estoque não pode ser negativa.',
  'costPrice.regex': 'Preço de custo inválido (até 10 casas decimais).',
  'decimal': 'Use no máximo 4 casas decimais.',
  'max': 'Valor muito alto.',
})

/** Custo: decimal(20,10) em texto — até 10 dígitos inteiros e 10 casas. */
const COST_PRICE_REGEX = /^\d{1,10}(\.\d{1,10})?$/

const PRODUCT_TYPES = ['consumable', 'fixed_asset', 'tool'] as const

export const createProductValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120),
    type: vine.enum(PRODUCT_TYPES),
    productGroupId: vine.number().positive().optional().nullable(),
    productSubgroupId: vine.number().positive().optional().nullable(),
    unitOfMeasureId: vine.number().positive().optional().nullable(),
    controlsStock: vine.boolean().optional(),
    minimumStock: vine.number().min(0).max(99999999999).decimal([0, 4]).optional().nullable(),
    quantityInStock: vine.number().min(0).max(99999999999).decimal([0, 4]).optional().nullable(),
    costPrice: vine.string().trim().regex(COST_PRICE_REGEX).optional().nullable(),
    isActive: vine.boolean().optional(),
  })
)
createProductValidator.messagesProvider = messages

export const updateProductValidator = vine.compile(
  vine.object({
    description: vine.string().trim().minLength(1).maxLength(120).optional(),
    type: vine.enum(PRODUCT_TYPES).optional(),
    productGroupId: vine.number().positive().optional().nullable(),
    productSubgroupId: vine.number().positive().optional().nullable(),
    unitOfMeasureId: vine.number().positive().optional().nullable(),
    controlsStock: vine.boolean().optional(),
    minimumStock: vine.number().min(0).max(99999999999).decimal([0, 4]).optional().nullable(),
    // quantityInStock intentionally omitted — immutable after create (strategy A).
    costPrice: vine.string().trim().regex(COST_PRICE_REGEX).optional().nullable(),
    isActive: vine.boolean().optional(),
  })
)
updateProductValidator.messagesProvider = messages
