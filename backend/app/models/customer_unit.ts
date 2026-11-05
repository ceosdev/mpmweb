import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import CustomerRegion from '#models/customer_region'

/**
 * CustomerUnit — child of a CustomerRegion, per-company. Hard delete.
 * `companyId` is denormalized; the FK to `customer_regions` is the
 * authoritative parent link (the customer is derived through it).
 */
export default class CustomerUnit extends BaseModel {
  static table = 'customer_units'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'customer_region_id' })
  declare customerRegionId: number

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

  @belongsTo(() => CustomerRegion)
  declare customerRegion: BelongsTo<typeof CustomerRegion>
}
