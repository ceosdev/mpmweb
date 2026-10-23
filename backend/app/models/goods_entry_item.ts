import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Product from '#models/product'
import GoodsEntry from '#models/goods_entry'

/**
 * What finalizing the entry did to the product, recorded per item so the
 * cancellation reverses exactly that: `stock` = added to the balance,
 * `asset` = generated product_assets, `none` = nothing (no stock control).
 */
export type StockEffect = 'stock' | 'none' | 'asset'

/**
 * One product line of a goods entry. The line total is **derived, never
 * stored**. `quantity` / `unitPrice` are decimal strings (driver output) and
 * must go through the BigInt helpers in `#utils/decimal`, never `Number()`.
 */
export default class GoodsEntryItem extends BaseModel {
  static table = 'goods_entry_items'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'goods_entry_id' })
  declare goodsEntryId: number

  @column({ columnName: 'product_id' })
  declare productId: number

  @column()
  declare quantity: string

  @column({ columnName: 'unit_price' })
  declare unitPrice: string

  @column()
  declare discount: number

  /** Null until the entry is finalized. */
  @column({ columnName: 'stock_effect' })
  declare stockEffect: StockEffect | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => GoodsEntry)
  declare goodsEntry: BelongsTo<typeof GoodsEntry>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
