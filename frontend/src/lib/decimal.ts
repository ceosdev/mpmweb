/**
 * Exact decimal arithmetic on scaled `BigInt`s — **display only** (totals shown
 * on the goods-entry form). Mirrors `backend/app/utils/decimal.ts`; the backend
 * stays the authority for persisted values. Quantity (4 places) × price (10
 * places) exceeds what a JS `number` holds exactly, so nothing here uses `Number`.
 */

const QTY_SCALE = 4
const PRICE_SCALE = 10

const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d*))?$/

/** Integer division rounding half-up, symmetric around zero. */
function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error('divRoundHalfUp: denominador não pode ser zero.')

  const negative = numerator < 0n !== denominator < 0n
  const absNum = numerator < 0n ? -numerator : numerator
  const absDen = denominator < 0n ? -denominator : denominator

  let quotient = absNum / absDen
  if ((absNum % absDen) * 2n >= absDen) quotient += 1n

  return negative ? -quotient : quotient
}

/** Decimal string (`'2.53'`) → integer scaled by `10 ** scale`, extra digits rounded half-up. */
function toScaled(value: string, scale: number): bigint {
  const match = DECIMAL_PATTERN.exec(value.trim())
  if (!match) throw new Error(`toScaled: valor decimal inválido (${value}).`)

  const [, sign, intPart, fracPart = ''] = match
  const kept = fracPart.slice(0, scale).padEnd(scale, '0')
  let scaled = BigInt(intPart + kept)
  if (fracPart.length > scale && fracPart.charCodeAt(scale) >= 53 /* '5' */) scaled += 1n

  return sign === '-' ? -scaled : scaled
}

/** Gross value of a line in **cents**: `round(quantity × unitPrice, 2)`, half-up. */
export function lineGrossCents(quantity: string, unitPrice: string): bigint {
  const product = toScaled(quantity, QTY_SCALE) * toScaled(unitPrice, PRICE_SCALE)
  return divRoundHalfUp(product, 10n ** BigInt(QTY_SCALE + PRICE_SCALE - 2))
}
