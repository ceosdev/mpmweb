import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import { DateTime } from 'luxon'
import { todayIso } from '#utils/dates'

/**
 * Validators for the Inventories module.
 *
 * **`status`, `openedByUserId`, `closedAt`, `closedByUserId`, `stockQuantity`
 * and `stockAtClose` are absent on purpose** — they are results stamped by the
 * service; VineJS drops unknown keys, so a payload carrying them is ignored.
 */

const messages = new SimpleMessagesProvider({
  'required': 'Campo obrigatório.',
  'number': 'Deve ser um número.',
  'array': 'Valor inválido.',
  'openingDate.required': 'Data de abertura é obrigatória.',
  'openingDate.date': 'Data de abertura inválida.',
  'openingDate.notFuture': 'A data de abertura não pode ser futura.',
  'productGroupIds.required': 'Informe os grupos de produto.',
  'productGroupIds.distinct': 'Grupo de produto repetido.',
  'productGroupIds.*.number': 'Grupo de produto inválido.',
  'productGroupIds.*.min': 'Grupo de produto inválido.',
})

/** `YYYY-MM-DD` — the format `<input type="date">` submits. */
const DATE_FORMAT = { formats: ['YYYY-MM-DD'] }

/**
 * Not after "today" in the application's timezone. Compared as `YYYY-MM-DD`
 * strings (the date arrives as midnight of the typed day), so the check does
 * not depend on the server clock's timezone.
 */
const notFuture = vine.createRule((value, _options, field) => {
  const iso = DateTime.fromJSDate(value as Date).toISODate()
  if (iso && iso > todayIso()) field.report('', 'notFuture', field)
})

/** Empty `productGroupIds` means "all groups". */
export const openInventoryValidator = vine.compile(
  vine.object({
    openingDate: vine.date(DATE_FORMAT).use(notFuture()),
    productGroupIds: vine.array(vine.number().withoutDecimals().min(1)).distinct(),
  })
)
openInventoryValidator.messagesProvider = messages
