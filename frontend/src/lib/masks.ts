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
 * 11 integer and 4 fraction digits — `decimal(15,4)`). Unlike `maskMoney`, decimals are NOT slid in from the
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
  const intPart = parts[0].replace(/^0+(?=\d)/, '').slice(0, 11)
  const intFmt = (intPart === '' && parts.length > 1 ? '0' : intPart).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '.'
  )
  if (parts.length > 1) {
    return `${intFmt},${parts[1].slice(0, 4)}`
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

/**
 * pt-BR masked quantity ("1.234,5678") → decimal **string** ("1234.5678"), or
 * null when empty. Same string-only conversion as `parseDecimalPrice`.
 */
export function parseQuantity(masked: string): string | null {
  return parseDecimalPrice(masked)
}

/** Formats a numeric quantity in pt-BR (up to 4 fraction digits). */
export function formatQuantity(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}

/**
 * Mask for a free decimal price/cost in pt-BR (comma decimal, dot thousands, up
 * to 10 fraction digits — matches `decimal(20,10)`). Same typing behaviour as
 * `maskQuantity`. Convert with `parseDecimalPrice`.
 */
export function maskDecimalPrice(raw: string): string {
  if (!raw) return ''
  let s = raw.replace(/[^\d,]/g, '')
  const firstComma = s.indexOf(',')
  if (firstComma !== -1) {
    s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, '')
  }
  const parts = s.split(',')
  const intPart = parts[0].replace(/^0+(?=\d)/, '').slice(0, 10)
  const intFmt = (intPart === '' && parts.length > 1 ? '0' : intPart).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '.'
  )
  if (parts.length > 1) return `${intFmt},${parts[1].slice(0, 10)}`
  return intFmt
}

/**
 * pt-BR masked price ("1.234,5678") → decimal **string** with a dot
 * ("1234.5678"), or null when empty. Pure string manipulation — never goes
 * through `Number`, so 10 fraction digits survive.
 */
export function parseDecimalPrice(masked: string): string | null {
  if (!masked) return null
  const [intRaw, fracRaw = ''] = masked.replace(/\./g, '').split(',')
  const int = intRaw.replace(/\D/g, '') || '0'
  const frac = fracRaw.replace(/\D/g, '')
  if (!/\d/.test(masked)) return null
  return frac ? `${int}.${frac}` : int
}

/** Casas fixas do Preço do item da entrada de mercadoria (`R$ 0,00`). */
const UNIT_PRICE_FRACTION = 2

/**
 * Máscara do Preço do item da entrada de mercadoria: padrão brasileiro de
 * valor, igual a `maskMoney` (prefixo R$, 2 casas, os dígitos entram pela
 * direita), mas devolvendo/consumindo **string** — sem `Number` no caminho.
 * Parte inteira limitada a 10 dígitos (`decimal(20,10)` no banco, que segue
 * aceitando mais casas vindas de outras origens). É o **modo centavos**; a
 * vírgula liga o modo decimal (`maskUnitPriceDecimal`). Converta com
 * `parseUnitPrice`.
 */
export function maskUnitPrice(raw: string): string {
  const d = onlyDigits(raw)
    .replace(/^0+(?=\d)/, '')
    .slice(0, 10 + UNIT_PRICE_FRACTION)
  if (!d) return ''
  const padded = d.padStart(UNIT_PRICE_FRACTION + 1, '0')
  const intPart = padded.slice(0, -UNIT_PRICE_FRACTION).replace(/^0+(?=\d)/, '')
  const decPart = padded.slice(-UNIT_PRICE_FRACTION)
  return `R$ ${groupThousands(intPart)},${decPart}`
}

/** Teto de casas do Preço quando o usuário digita a vírgula (`qCom`/`vUnCom` raros). */
const UNIT_PRICE_MAX_FRACTION = 4

const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/**
 * **Modo decimal** do Preço, ligado quando o usuário aperta a vírgula: o que
 * vem antes dela é a parte inteira e os dígitos seguintes são as casas, até 4
 * (`75,7729` → `R$ 75,7729`). Devolve `null` quando a vírgula sumiu do valor
 * (o usuário a apagou) — o chamador volta ao modo centavos (`maskUnitPrice`).
 */
export function maskUnitPriceDecimal(raw: string): string | null {
  const commaAt = raw.indexOf(',')
  if (commaAt === -1) return null
  const intPart = onlyDigits(raw.slice(0, commaAt)).replace(/^0+(?=\d)/, '').slice(0, 10) || '0'
  const frac = onlyDigits(raw.slice(commaAt + 1)).slice(0, UNIT_PRICE_MAX_FRACTION)
  return `R$ ${groupThousands(intPart)},${frac}`
}

/**
 * Passa do modo centavos para o modo decimal no instante em que a vírgula é
 * apertada: os dígitos já digitados viram a **parte inteira**. Quem digitou
 * `7`, `5` (exibido `R$ 0,75`) e apertou a vírgula fica com `R$ 75,`.
 */
export function unitPriceToDecimalMode(masked: string): string {
  const intPart = onlyDigits(masked).replace(/^0+(?=\d)/, '').slice(0, 10) || '0'
  return `R$ ${groupThousands(intPart)},`
}

/**
 * `"R$ 1.234,56"` / `"R$ 75,7729"` / `"R$ 75,"` → `"1234.56"` / `"75.7729"` /
 * `"75"`; vazio → `null`. Vale para os dois modos, porque ambos exibem
 * `R$ inteiro,casas`. String pura, sem `Number`.
 */
export function parseUnitPrice(masked: string): string | null {
  if (!/\d/.test(masked)) return null
  const [intRaw, fracRaw = ''] = masked.split(',')
  const int = onlyDigits(intRaw).replace(/^0+(?=\d)/, '') || '0'
  const frac = onlyDigits(fracRaw)
  return frac ? `${int}.${frac}` : int
}

/**
 * O valor exibido está no modo decimal? Só ele produz um número de casas
 * diferente de 2 — o modo centavos sempre mostra exatamente 2.
 */
export function isUnitPriceDecimalMode(masked: string): boolean {
  const commaAt = masked.indexOf(',')
  return commaAt !== -1 && masked.length - commaAt - 1 !== UNIT_PRICE_FRACTION
}

/**
 * Preço/custo da API (`"3.4566666667"`) → valor do campo Preço, arredondado
 * (half-up) para no máximo 4 casas. Com até 2 casas significativas, sai no
 * modo centavos (`"5300.0000000000"` → `"R$ 5.300,00"`); com 3 ou 4, no modo
 * decimal (`"3.4566666667"` → `"R$ 3,4567"`). `null` → `''`.
 */
export function unitPriceToMask(value: string | null): string {
  if (value === null || value === '') return ''
  const [intPart, frac = ''] = formatDecimalPrice(value, UNIT_PRICE_MAX_FRACTION).split(',')
  if (frac.length > UNIT_PRICE_FRACTION) return `R$ ${intPart},${frac}`
  return maskUnitPrice(intPart + frac.padEnd(UNIT_PRICE_FRACTION, '0'))
}

/**
 * Decimal string from the API ("3.4566666667") → pt-BR display with at most
 * `maxFraction` significant fraction digits (half-up) and at least 2.
 * `null` → "—". No `Number` involved.
 */
export function formatDecimalPrice(value: string | null, maxFraction = 10): string {
  if (value === null || value === undefined || value === '') return '—'
  const [intRaw, fracRaw = ''] = value.split('.')
  let int = BigInt(intRaw || '0')
  let frac = fracRaw
  if (frac.length > maxFraction) {
    const roundUp = frac.charCodeAt(maxFraction) >= 53 // '5'
    frac = frac.slice(0, maxFraction)
    if (roundUp) {
      const scaled = BigInt(int.toString() + frac) + 1n
      const str = scaled.toString().padStart(frac.length + 1, '0')
      int = BigInt(str.slice(0, str.length - frac.length))
      frac = frac.length ? str.slice(-frac.length) : ''
    }
  }
  frac = frac.replace(/0+$/, '').padEnd(2, '0')
  const intFmt = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${intFmt},${frac}`
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
 * `modules/services/service-form-dialog.tsx`.
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
