import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Inventory from '#models/inventory'
import Product from '#models/product'

/**
 * One product line of an inventory. Situation and difference are **derived,
 * never stored**. The decimals are strings (driver output) and must go through
 * the BigInt helpers in `#utils/decimal`, never `Number()`.
 */
export default class InventoryItem extends BaseModel {
  static table = 'inventory_items'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'inventory_id' })
  declare inventoryId: number

  @column({ columnName: 'product_id' })
  declare productId: number

  /** Snapshot of the stock balance at opening. */
  @column({ columnName: 'stock_quantity' })
  declare stockQuantity: string

  /** Null means "not counted"; zero is a valid count. */
  @column({ columnName: 'counted_quantity' })
  declare countedQuantity: string | null

  /** Balance at close time, before the adjustment; null while open or not adjusted. */
  @column({ columnName: 'stock_at_close' })
  declare stockAtClose: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => Inventory)
  declare inventory: BelongsTo<typeof Inventory>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
