import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Customer from '#models/customer'

/**
 * CustomerRegion — child of a Customer, per-company. Hard delete.
 * `companyId` is denormalized; the FK to `customers` is the authoritative
 * parent link.
 */
export default class CustomerRegion extends BaseModel {
  static table = 'customer_regions'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'customer_id' })
  declare customerId: number

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

  @belongsTo(() => Customer)
  declare customer: BelongsTo<typeof Customer>
}
