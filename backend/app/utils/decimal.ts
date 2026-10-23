/**
 * Exact decimal arithmetic on scaled `BigInt`s.
 *
 * Quantity (4 places) × price (10 places) has 14 places and up to ~25 digits —
 * beyond what a JS `number` holds exactly (`2.53 × 18.9` already drifts). So
 * every calculation over quantity, price and cost runs on integers scaled by
 * `10 ** scale` and rounds **half-up** (away from zero for negatives). Values
 * cross the API and the `pg` driver as decimal strings and never touch `Number`.
 */

/** Decimal places of `quantity` columns (`decimal(15,4)`). */
export const QTY_SCALE = 4
/** Decimal places of `unit_price` / `cost_price` columns (`decimal(20,10)`). */
export const PRICE_SCALE = 10

const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d*))?$/

/**
 * Division of integers rounding **half-up**, symmetric around zero:
 * `5/2 → 3` and `-5/2 → -3`. BigInt `/` truncates toward zero, so the
 * remainder decides whether to step one unit away from zero.
 */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error('divRoundHalfUp: denominador não pode ser zero.')
  }

  const negative = numerator < 0n !== denominator < 0n
  const absNum = numerator < 0n ? -numerator : numerator
  const absDen = denominator < 0n ? -denominator : denominator

  let quotient = absNum / absDen
  if ((absNum % absDen) * 2n >= absDen) quotient += 1n

  return negative ? -quotient : quotient
}

/**
 * Parses a decimal string (or integer) into an integer scaled by `10 ** scale`:
 * `'2.53'`, 4 → `25300n`. Digits beyond `scale` are rounded half-up.
 * Anything that is not plain decimal notation (exponent, `NaN`, empty, comma)
 * throws — a silent `0` would corrupt totals and stock.
 */
export function toScaled(value: string | number, scale: number): bigint {
  const text = typeof value === 'number' ? numberToString(value) : value.trim()
  const match = DECIMAL_PATTERN.exec(text)
  if (!match) {
    throw new Error(`toScaled: valor decimal inválido (${String(value)}).`)
  }

  const [, sign, intPart, fracPart = ''] = match
  const kept = fracPart.slice(0, scale).padEnd(scale, '0')
  let scaled = BigInt(intPart + kept)

  // Round half-up on the first dropped digit.
  if (fracPart.length > scale && fracPart.charCodeAt(scale) >= 53 /* '5' */) {
    scaled += 1n
  }

  return sign === '-' ? -scaled : scaled
}

function numberToString(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`toScaled: valor decimal inválido (${value}).`)
  }
  return String(value)
}

/** Back to a decimal string with exactly `scale` places: `25300n`, 4 → `'2.5300'`. */
export function fromScaled(value: bigint, scale: number): string {
  const negative = value < 0n
  const digits = (negative ? -value : value).toString().padStart(scale + 1, '0')
  const intPart = digits.slice(0, digits.length - scale)
  const fracPart = digits.slice(digits.length - scale)
  const text = scale > 0 ? `${intPart}.${fracPart}` : intPart
  return negative ? `-${text}` : text
}

/**
 * Gross value of a line in **cents**: `round(quantity × unitPrice, 2)`.
 * The product has scale 4 + 10 = 14, so dropping 12 places yields cents.
 */
export function lineGrossCents(quantity: string, unitPrice: string): bigint {
  const product = toScaled(quantity, QTY_SCALE) * toScaled(unitPrice, PRICE_SCALE)
  return divRoundHalfUp(product, 10n ** BigInt(QTY_SCALE + PRICE_SCALE - 2))
}

/**
 * Unit cost (scale 10) of a line whose net total is `lineNetCents`:
 * `lineNet ÷ quantity`. cents/10² ÷ qty/10⁴ at scale 10 is
 * `cents × 10¹² ÷ scaledQty`.
 */
export function unitCostFromLine(lineNetCents: bigint, quantity: string): string {
  const qty = toScaled(quantity, QTY_SCALE)
  const cost = divRoundHalfUp(lineNetCents * 10n ** BigInt(PRICE_SCALE + QTY_SCALE - 2), qty)
  return fromScaled(cost, PRICE_SCALE)
}

/**
 * Weighted average cost after receiving `quantity` for `lineNetCents`:
 * `(stock × cost + lineNet) ÷ (stock + quantity)`, scale 10, half-up.
 *
 * With no balance to weigh (`stock ≤ 0` — a negative balance would pull the
 * average the wrong way — or no previous cost) the new cost is simply the
 * entry's unit cost. Stock × cost has scale 14, so the line total (cents) is
 * lifted by 10¹² and the division by `stock + quantity` (scale 4) leaves scale 10.
 */
export function weightedAverageCost(p: {
  stock: string | null
  cost: string | null
  quantity: string
  lineNetCents: bigint
}): string {
  const stock = p.stock === null ? 0n : toScaled(p.stock, QTY_SCALE)
  if (stock <= 0n || p.cost === null) {
    return unitCostFromLine(p.lineNetCents, p.quantity)
  }

  const qty = toScaled(p.quantity, QTY_SCALE)
  const cost = toScaled(p.cost, PRICE_SCALE)
  const numerator = stock * cost + p.lineNetCents * 10n ** BigInt(QTY_SCALE + PRICE_SCALE - 2)
  return fromScaled(divRoundHalfUp(numerator, stock + qty), PRICE_SCALE)
}
