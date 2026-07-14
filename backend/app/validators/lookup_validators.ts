import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validator shared by every lookup endpoint (`GET /api/<entity>/lookup`), used
 * by the EntityPicker on the frontend. See
 * `docs/spec/comum/001-componente-entity-picker.md`.
 *
 * Exactly one of `q` (search term) or `ids` (hydration) is expected. Enforcing
 * "one of the two" is a business rule, so it lives in the service — here we only
 * validate the shape of whatever was sent.
 */

const messages = new SimpleMessagesProvider({
  'q.minLength': 'Informe ao menos 2 caracteres para buscar.',
  'q.maxLength': 'Termo de busca muito longo.',
  'limit.min': 'O limite mínimo é 1.',
  'limit.max': 'O limite máximo é 20.',
})

export const lookupValidator = vine.compile(
  vine.object({
    q: vine.string().trim().minLength(2).maxLength(120).optional(),
    /**
     * Deliberately untyped here: `?ids=7` chega como string e `?ids=7,9` chega
     * como array (o parser de query string quebra na vírgula, e o axios manda a
     * vírgula crua). Quem normaliza e valida o conteúdo é o `parseLookupIds`.
     */
    ids: vine.any().optional(),
    limit: vine.number().withoutDecimals().min(1).max(20).optional(),
  })
)
lookupValidator.messagesProvider = messages
