import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Product from '#models/product'
import GoodsExit from '#models/goods_exit'

/**
 * One product line of a goods exit. Line values are **derived, never stored**.
 * The decimals are strings (driver output) and must go through the BigInt
 * helpers in `#utils/decimal`, never `Number()`.
 */
export default class GoodsExitItem extends BaseModel {
  static table = 'goods_exit_items'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'goods_exit_id' })
  declare goodsExitId: number

  @column({ columnName: 'product_id' })
  declare productId: number

  @column({ columnName: 'requested_quantity' })
  declare requestedQuantity: string

  /** Normal exit only; null until finalized. */
  @column({ columnName: 'consumed_quantity' })
  declare consumedQuantity: string | null

  /** Snapshot of the product cost; rewritten on finalize. Null without cost. */
  @column({ columnName: 'unit_cost' })
  declare unitCost: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => GoodsExit)
  declare goodsExit: BelongsTo<typeof GoodsExit>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
