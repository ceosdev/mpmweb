import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import ProductGroup from '#models/product_group'

/**
 * ProductSubgroup — child of a ProductGroup, per-company. Hard delete.
 * `companyId` is denormalized; the FK to `product_groups` is the authoritative
 * parent link.
 */
export default class ProductSubgroup extends BaseModel {
  static table = 'product_subgroups'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'product_group_id' })
  declare productGroupId: number

  @column()
  declare description: string

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => ProductGroup)
  declare productGroup: BelongsTo<typeof ProductGroup>
}
