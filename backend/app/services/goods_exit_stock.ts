import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Product from '#models/product'
import { BusinessException } from '#exceptions/app_exception'
import { QTY_SCALE, fromScaled, toScaled } from '#utils/decimal'

/**
 * Stock side of a goods exit (finalize, deliver, return). Everything runs
 * inside the caller's transaction.
 *
 * Products are locked `forUpdate()` in **ascending id** order — the same order
 * the goods entry uses — so concurrent movements on a product never lose an
 * update and never deadlock. The balance is changed by a SQL expression over
 * the locked row, never read-add-write.
 */

/** Locks the products of the tenant in ascending id order and returns them by id. */
export async function lockProducts(
  trx: TransactionClientContract,
  companyId: number,
  productIds: number[]
): Promise<Map<number, Product>> {
  const ids = [...new Set(productIds)].sort((a, b) => a - b)
  if (ids.length === 0) return new Map()

  const rows = await Product.query({ client: trx })
    .where('company_id', companyId)
    .whereIn('id', ids)
    .orderBy('id', 'asc')
    .forUpdate()

  if (rows.length !== ids.length) throw new BusinessException('Produto inválido.')
  return new Map(rows.map((row) => [row.id, row]))
}

/**
 * Adds `delta` (signed decimal string; negative takes out) to the product's
 * balance. A `null` balance counts as 0. The product must already be locked by
 * `lockProducts` in the same transaction.
 */
export async function moveStock(
  trx: TransactionClientContract,
  productId: number,
  delta: string
): Promise<void> {
  const quantity = fromScaled(toScaled(delta, QTY_SCALE), QTY_SCALE)
  await trx
    .from('products')
    .where('id', productId)
    .update({
      quantity_in_stock: trx.knexRawQuery('coalesce(quantity_in_stock, 0) + ?::numeric', [quantity]),
      updated_at: new Date(),
    })
}

/** Current balance of a (locked) product, scaled; `null` counts as 0. */
export function stockScaled(product: Pick<Product, 'quantityInStock'>): bigint {
  return toScaled(product.quantityInStock ?? '0', QTY_SCALE)
}
