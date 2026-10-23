import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type GoodsEntry from '#models/goods_entry'
import type GoodsEntryItem from '#models/goods_entry_item'
import type { StockEffect } from '#models/goods_entry_item'
import Product from '#models/product'
import ProductAsset, { type AssetSituation } from '#models/product_asset'
import type { TenantContext } from '#services/tenant_context'
import { BusinessException } from '#exceptions/app_exception'
import {
  PRICE_SCALE,
  QTY_SCALE,
  fromScaled,
  lineGrossCents,
  toScaled,
  unitCostFromLine,
  weightedAverageCost,
} from '#utils/decimal'

/** One unit of quantity at `QTY_SCALE` (`1.0000` → `10000n`). */
const QTY_UNIT = 10n ** BigInt(QTY_SCALE)

/** Teto de unidades por item de produto ativo — cada unidade vira um ativo. */
const MAX_ASSET_QUANTITY_SCALED = 999n * QTY_UNIT

const SITUATION_LABELS: Record<AssetSituation, string> = {
  available: 'disponível',
  allocated: 'alocado',
  sold: 'vendido',
}

/**
 * What finalizing an item does to its product, from the product's **current**
 * type and stock control (see the table in the spec, "Efeito em cada produto").
 */
export function resolveStockEffect(product: Pick<Product, 'type' | 'controlsStock'>): StockEffect {
  if (product.type === 'fixed_asset') return 'asset'
  return product.controlsStock ? 'stock' : 'none'
}

/**
 * Product side of a goods entry: applying (finalize) and reversing (cancel)
 * stock balance, cost and generated assets. Every method runs inside the
 * caller's transaction and locks the products in **ascending id** order —
 * concurrent finalizations on the same product never lose a sum, and the fixed
 * order avoids deadlocks.
 *
 * Quantity, price and cost never go through `Number()`: they are decimal
 * strings converted to scaled `BigInt` by `#utils/decimal`.
 */
export class GoodsEntryStock {
  /**
   * Applies every item's effect. Validates **all** items against the locked
   * product state first (the product may have changed since the entry was
   * saved), and only then writes — a 422 here leaves nothing behind even
   * before the transaction rolls back.
   */
  async apply(
    tenant: TenantContext,
    entry: GoodsEntry,
    items: GoodsEntryItem[],
    trx: TransactionClientContract
  ): Promise<void> {
    const products = await this.lockProducts(tenant, items, trx)

    const plans = items.map((item) => {
      const product = products.get(item.productId)!
      const effect = resolveStockEffect(product)
      const quantityScaled = toScaled(item.quantity, QTY_SCALE)

      if (effect === 'asset') {
        if (quantityScaled % QTY_UNIT !== 0n) {
          throw new BusinessException(
            `O produto ${product.description} é um ativo: a quantidade precisa ser inteira.`
          )
        }
        if (quantityScaled > MAX_ASSET_QUANTITY_SCALED) {
          throw new BusinessException('A quantidade máxima para produto ativo é 999.')
        }
      }

      const lineNetCents = lineGrossCents(item.quantity, item.unitPrice) - moneyCents(item.discount)
      return { item, product, effect, quantityScaled, lineNetCents }
    })

    for (const { item, product, effect, quantityScaled, lineNetCents } of plans) {
      const quantity = fromScaled(quantityScaled, QTY_SCALE)

      // Bonificação (custo unitário zero): aplica estoque/ativos mas não toca
      // no `cost_price` — nem como último custo, nem dentro do médio.
      const entryUnitCost = lineNetCents > 0n ? unitCostFromLine(lineNetCents, quantity) : null
      const hasCost = entryUnitCost !== null && toScaled(entryUnitCost, PRICE_SCALE) > 0n

      const values: Record<string, unknown> = {}

      if (effect === 'stock') {
        // Expressão SQL, nunca ler-somar-gravar.
        values.quantity_in_stock = trx.knexRawQuery('coalesce(quantity_in_stock, 0) + ?::numeric', [quantity])
        if (hasCost) {
          // Médio ponderado sobre o saldo/custo **antes** desta entrada (linha travada).
          values.cost_price = weightedAverageCost({
            stock: product.quantityInStock,
            cost: product.costPrice,
            quantity,
            lineNetCents,
          })
        }
      } else if (hasCost) {
        // `none` / `asset`: último custo.
        values.cost_price = entryUnitCost
      }

      if (Object.keys(values).length > 0) {
        values.updated_at = new Date()
        await trx
          .from('products')
          .where('company_id', tenant.company.id)
          .where('id', product.id)
          .update(values)
      }

      if (effect === 'asset') {
        const count = Number(quantityScaled / QTY_UNIT)
        await ProductAsset.createMany(
          Array.from({ length: count }, () => ({
            companyId: tenant.company.id,
            productId: product.id,
            goodsEntryId: entry.id,
            description: product.description,
            assetCode: null,
            situation: 'available' as const,
            equipmentExists: false,
            brandId: null,
            brandModelId: null,
            manufactureYear: null,
            btu: null,
            notes: null,
          })),
          { client: trx }
        )
      }

      item.stockEffect = effect
      item.useTransaction(trx)
      await item.save()
    }
  }

  /**
   * Checks the three cancellation blockers of the spec **without changing
   * anything**. Locks the products (ascending id) and the generated assets, so
   * nothing moves between this check and `reverse`.
   */
  async assertReversible(
    tenant: TenantContext,
    entry: GoodsEntry,
    items: GoodsEntryItem[],
    trx: TransactionClientContract
  ): Promise<void> {
    const products = await this.lockProducts(tenant, items, trx)

    const assets = await ProductAsset.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('goods_entry_id', entry.id)
      .orderBy('id', 'asc')
      .forUpdate()

    for (const item of items) {
      const product = products.get(item.productId)!

      if (item.stockEffect === 'stock') {
        if (!product.controlsStock) {
          throw new BusinessException(
            `Não é possível cancelar: o produto ${product.description} não controla mais estoque.`
          )
        }
        const balance = toScaled(product.quantityInStock ?? '0', QTY_SCALE)
        const quantity = toScaled(item.quantity, QTY_SCALE)
        if (balance - quantity < 0n) {
          throw new BusinessException(
            `Não é possível cancelar: o estoque de ${product.description} ficaria negativo (${formatQuantity(balance)} − ${formatQuantity(quantity)}).`
          )
        }
      }

      if (item.stockEffect === 'asset') {
        const blocked = assets.find(
          (asset) => asset.productId === product.id && asset.situation !== 'available'
        )
        if (blocked) {
          const label = blocked.assetCode || `#${blocked.id}`
          throw new BusinessException(
            `Não é possível cancelar: o ativo ${label} do produto ${product.description} está ${SITUATION_LABELS[blocked.situation]}.`
          )
        }
      }
    }
  }

  /**
   * Reverses what `apply` did, by the **recorded** `stock_effect` (not the
   * product's current state): decrements the balance of `stock` items and
   * deletes the assets generated by the entry. Cost is left untouched — the
   * average is cumulative and other entries may have moved it since.
   *
   * Must run after `assertReversible` in the same transaction.
   */
  async reverse(
    tenant: TenantContext,
    entry: GoodsEntry,
    items: GoodsEntryItem[],
    trx: TransactionClientContract
  ): Promise<void> {
    const stockItems = [...items]
      .filter((item) => item.stockEffect === 'stock')
      .sort((a, b) => a.productId - b.productId)

    for (const item of stockItems) {
      const quantity = fromScaled(toScaled(item.quantity, QTY_SCALE), QTY_SCALE)
      await trx
        .from('products')
        .where('company_id', tenant.company.id)
        .where('id', item.productId)
        .update({
          quantity_in_stock: trx.knexRawQuery('coalesce(quantity_in_stock, 0) - ?::numeric', [quantity]),
          updated_at: new Date(),
        })
    }

    await ProductAsset.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('goods_entry_id', entry.id)
      .delete()
  }

  /** Locks the items' products in ascending id order and returns them by id. */
  private async lockProducts(
    tenant: TenantContext,
    items: GoodsEntryItem[],
    trx: TransactionClientContract
  ): Promise<Map<number, Product>> {
    const ids = [...new Set(items.map((item) => item.productId))].sort((a, b) => a - b)
    if (ids.length === 0) return new Map()

    const rows = await Product.query({ client: trx })
      .where('company_id', tenant.company.id)
      .whereIn('id', ids)
      .orderBy('id', 'asc')
      .forUpdate()

    if (rows.length !== ids.length) throw new BusinessException('Produto inválido.')
    return new Map(rows.map((row) => [row.id, row]))
  }
}

/** `decimal(12,2)` money (string from the driver or number) → cents, exact. */
function moneyCents(value: number | string | null | undefined): bigint {
  return toScaled(value ?? 0, 2)
}

/** Scaled quantity → pt-BR text for messages: `25300n` → `2,53`; `-50000n` → `-5`. */
function formatQuantity(scaled: bigint): string {
  const negative = scaled < 0n
  const [intPart, fracPart] = fromScaled(negative ? -scaled : scaled, QTY_SCALE).split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fraction = fracPart.replace(/0+$/, '')
  return `${negative ? '-' : ''}${grouped}${fraction ? `,${fraction}` : ''}`
}

export default new GoodsEntryStock()
