import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validators for the Roles module. The slug is in kebab-case, must start with
 * a lowercase letter and cannot be `root` (reserved for the platform-level
 * master role). Uniqueness within a company is checked in the service layer.
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'string': 'Deve ser um texto.',
  'array': 'Deve ser uma lista.',
  'number': 'Deve ser um número.',
  'minLength': 'Deve ter ao menos {{ min }} caracteres.',
  'maxLength': 'Deve ter no máximo {{ max }} caracteres.',
  'regex': 'Formato inválido.',
  'notIn': 'Valor reservado, escolha outro.',
  'name.minLength': 'Nome é obrigatório.',
  'name.required': 'Nome é obrigatório.',
  'name.maxLength': 'Nome deve ter no máximo {{ max }} caracteres.',
  'slug.minLength': 'Slug é obrigatório.',
  'slug.required': 'Slug é obrigatório.',
  'slug.regex':
    'Slug deve começar com letra minúscula e conter apenas letras, números, "-" ou "_".',
  'slug.maxLength': 'Slug deve ter no máximo {{ max }} caracteres.',
  'slug.notIn': 'O slug "root" é reservado e não pode ser usado.',
  'description.maxLength': 'Descrição deve ter no máximo {{ max }} caracteres.',
  'permissions.array': 'Permissões devem ser uma lista.',
})

const SLUG_REGEX = /^[a-z][a-z0-9_-]*$/
const RESERVED_SLUGS = ['root']

export const createRoleValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80),
    slug: vine
      .string()
      .trim()
      .toLowerCase()
      .minLength(1)
      .maxLength(40)
      .regex(SLUG_REGEX)
      .notIn(RESERVED_SLUGS),
    description: vine.string().trim().maxLength(255).optional(),
    isActive: vine.boolean().optional(),
    permissions: vine.array(vine.number().positive()).optional(),
  })
)
createRoleValidator.messagesProvider = messages

export const updateRoleValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80).optional(),
    slug: vine
      .string()
      .trim()
      .toLowerCase()
      .minLength(1)
      .maxLength(40)
      .regex(SLUG_REGEX)
      .notIn(RESERVED_SLUGS)
      .optional(),
    description: vine.string().trim().maxLength(255).nullable().optional(),
    isActive: vine.boolean().optional(),
    permissions: vine.array(vine.number().positive()).optional(),
  })
)
updateRoleValidator.messagesProvider = messages
