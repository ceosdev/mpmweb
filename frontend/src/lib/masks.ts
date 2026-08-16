/**
 * Display masks for CPF / CNPJ / CEP / telefone.
 *
 * The DB and the API always speak the raw, digits-only value. The frontend is
 * the only place that masks it for the user — both in inputs (while typing)
 * and in read-only cells.
 */

export const onlyDigits = (value: string | null | undefined): string =>
  (value ?? '').replace(/\D/g, '')

export function maskCpf(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function maskCnpj(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14)
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function maskCep(raw: string): string {
  const d = onlyDigits(raw).slice(0, 8)
  return d.replace(/(\d{5})(\d)/, '$1-$2')
}

/** Detects CPF (≤ 11 digits) vs CNPJ (> 11) and masks accordingly. */
export function maskTaxId(raw: string | null | undefined): string {
  if (!raw) return ''
  const d = onlyDigits(raw)
  if (!d) return ''
  return d.length <= 11 ? maskCpf(d) : maskCnpj(d)
}

export function maskPhone(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

/**
 * Money mask for an input whose raw value is digits-only **cents** (e.g. the
 * string `"12345"` displays as `R$ 123,45`). Pair with `MaskedInput`. Empty
 * input returns `''` so the placeholder shows.
 */
export function maskMoney(raw: string): string {
  const d = onlyDigits(raw)
  if (!d) return ''
  const cents = d.padStart(3, '0')
  const intPart = cents.slice(0, -2).replace(/^0+(?=\d)/, '')
  const decPart = cents.slice(-2)
  const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `R$ ${intFmt},${decPart}`
}

/** Formats a numeric value (in reais) as BRL for read-only display. */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Mask for a free decimal input in pt-BR (comma decimal, dot thousands, up to
 * 3 fraction digits). Unlike `maskMoney`, decimals are NOT slid in from the
 * right — the user types whole numbers naturally ("200") or adds a comma for
 * fractions ("2,5"). The form holds this masked string; convert it with
 * `parseDecimal` before sending to the API.
 */
export function maskQuantity(raw: string): string {
  if (!raw) return ''
  let s = raw.replace(/[^\d,]/g, '')
  // Keep only the first comma.
  const firstComma = s.indexOf(',')
  if (firstComma !== -1) {
    s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, '')
  }
  const parts = s.split(',')
  const intPart = parts[0].replace(/^0+(?=\d)/, '')
  const intFmt = (intPart === '' && parts.length > 1 ? '0' : intPart).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '.'
  )
  if (parts.length > 1) {
    return `${intFmt},${parts[1].slice(0, 3)}`
  }
  return intFmt
}

/** pt-BR masked decimal ("1.234,5") → number (1234.5), or null when empty. */
export function parseDecimal(masked: string): number | null {
  if (!masked) return null
  const normalized = masked.replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** Formats a numeric quantity in pt-BR (up to 3 fraction digits). */
export function formatQuantity(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

/**
 * Centavos ("12345") → reais (123.45). Vazio → 0.
 *
 * Vive aqui, e não em cada formulário, porque a conversão de centavos é
 * justamente onde uma cópia divergente causaria estrago silencioso.
 *
 * Contrato: vazio vira **zero**, não `null`/`undefined` — por isso serve a
 * campo monetário **obrigatório**, onde "sem valor" não é um estado válido e
 * o form já garante isso via schema (ex.: `amount` de título a pagar/receber).
 * Campo monetário **opcional/nullable**, onde vazio precisa continuar vazio
 * (virar `undefined`/`null`, nunca zero, para não gravar "custo zero" onde o
 * certo é "sem custo definido"), **não** usa esta função — mantém o próprio
 * conversor local de propósito. Ver `suggestedValue` em
 * `modules/services/service-form-dialog.tsx` e `costPrice` em
 * `modules/products/product-form-dialog.tsx`.
 */
export function centsToReais(cents: string): number {
  if (!cents) return 0
  return Number(cents) / 100
}

/** Reais (123.45) → centavos ("12345"), para o form. */
export function reaisToCents(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(Math.round(value * 100))
}
