import { BusinessException } from '#exceptions/app_exception'

/**
 * Shared pieces of the lookup endpoints consumed by the frontend EntityPicker.
 * See `docs/spec/comum/001-componente-entity-picker.md`.
 */

/** How many options a search returns when the caller does not ask for a limit. */
export const LOOKUP_DEFAULT_LIMIT = 10

/** Ceiling for the hydration mode, so a forged querystring cannot ask for everything. */
export const LOOKUP_MAX_IDS = 50

/** Minimum digits in the term before we also search the tax id (see `lookupTaxIdDigits`). */
const TAX_ID_MIN_DIGITS = 3

export interface LookupParams {
  /** Search term. Matches the entity name and, when numeric enough, the tax id. */
  q?: string
  /** Hydration: resolve these ids into labels, ignoring `is_active`. */
  ids?: number[]
  limit?: number
}

/**
 * Normalizes the `ids` query param into numbers, capped at `LOOKUP_MAX_IDS`.
 *
 * Accepts **both shapes** on purpose. `?ids=7,9` arrives here as the array
 * `['7','9']`, because the query-string parser splits on commas — and axios
 * (the frontend client) deliberately leaves commas unescaped, so that is the
 * request the EntityPicker actually sends. A single id (`?ids=7`) still arrives
 * as a plain string.
 */
export function parseLookupIds(raw: unknown): number[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined

  const parts = Array.isArray(raw) ? raw : String(raw).split(',')
  const ids = parts.map(Number).filter((id) => Number.isInteger(id) && id > 0)

  if (ids.length === 0) {
    throw new BusinessException('Lista de códigos inválida.')
  }

  return ids.slice(0, LOOKUP_MAX_IDS)
}

/**
 * Digits to match against `tax_id`, or `null` when the term does not look like a
 * document. Searching the tax id only once the term carries 3+ digits keeps a
 * plain-text search like "ac" from scanning `tax_id` for nothing, while "12.345"
 * still finds the CNPJ (we compare digits only, and `tax_id` is stored that way).
 */
export function lookupTaxIdDigits(term: string): string | null {
  const digits = term.replace(/\D/g, '')
  return digits.length >= TAX_ID_MIN_DIGITS ? digits : null
}
