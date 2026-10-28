import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Inventory from '#models/inventory'
import ProductGroup from '#models/product_group'

/** A group chosen when opening an inventory. No rows means "all groups". */
export default class InventoryProductGroup extends BaseModel {
  static table = 'inventory_product_groups'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'inventory_id' })
  declare inventoryId: number

  @column({ columnName: 'product_group_id' })
  declare productGroupId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => Inventory)
  declare inventory: BelongsTo<typeof Inventory>

  @belongsTo(() => ProductGroup)
  declare productGroup: BelongsTo<typeof ProductGroup>
}
