/**
 * Helpers da digitação da contagem. Não usa `maskQuantity`: ele trunca em 4 casas
 * enquanto digita, e a tela precisa **recusar** `1,23456` (e `-1`) com erro na
 * linha, então o texto fica cru e é validado ao confirmar.
 */

export type ParsedCount = { ok: true; value: string | null } | { ok: false; error: string }

export const INVALID_COUNT_MESSAGE =
  'Informe uma quantidade válida, de 0 com até 4 casas decimais.'

/** pt-BR ("1.234,5") → string decimal da API ("1234.5"); vazio → null (não contado). */
export function parseCount(text: string): ParsedCount {
  const t = text.trim()
  if (t === '') return { ok: true, value: null }
  // Ponto só como agrupamento de milhar ("1.234,5"); "5.2" e "1.2.3" são recusados.
  const m = /^(\d{1,3}(?:\.\d{3})+|\d{1,11})(?:,(\d{1,4}))?$/.exec(t)
  if (!m) return { ok: false, error: INVALID_COUNT_MESSAGE }
  const int = m[1].replace(/\./g, '')
  if (int.length > 11) return { ok: false, error: INVALID_COUNT_MESSAGE }
  return { ok: true, value: m[2] ? `${int}.${m[2]}` : int }
}

/** "5.2000" e "5.2" → "5.2"; "0.0000" → "0"; null → null. Para comparar valores. */
export function normalizeDecimal(value: string | null): string | null {
  if (value === null) return null
  const [int, frac = ''] = value.split('.')
  const f = frac.replace(/0+$/, '')
  const i = int.replace(/^0+(?=\d)/, '')
  return f ? `${i}.${f}` : i
}

const SCALE = 4

function toScaled(value: string): bigint {
  const [int, frac = ''] = value.split('.')
  return BigInt(int + frac.padEnd(SCALE, '0').slice(0, SCALE))
}

/** counted − stock com 4 casas ("0.5000", "-1.2000"); BigInt, nunca Number. */
export function differenceOf(counted: string, stock: string): string {
  const d = toScaled(counted) - toScaled(stock)
  const neg = d < 0n
  const abs = (neg ? -d : d).toString().padStart(SCALE + 1, '0')
  return `${neg ? '-' : ''}${abs.slice(0, -SCALE)}.${abs.slice(-SCALE)}`
}
