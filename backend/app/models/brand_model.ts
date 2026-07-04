import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Brand from '#models/brand'

/**
 * BrandModel — child of a Brand, per-company. Hard delete.
 * `companyId` is denormalized; the FK to `brands` is the authoritative
 * parent link.
 */
export default class BrandModel extends BaseModel {
  static table = 'brand_models'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'brand_id' })
  declare brandId: number

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

  @belongsTo(() => Brand)
  declare brand: BelongsTo<typeof Brand>
}
