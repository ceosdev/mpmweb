import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Service from '#models/service'
import ServiceEntry from '#models/service_entry'

/**
 * One service line of a service entry. The line total
 * (`quantity * unitPrice - discount`) is **derived, never stored** — same policy
 * as the payable's `total`.
 */
export default class ServiceEntryItem extends BaseModel {
  static table = 'service_entry_items'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'service_entry_id' })
  declare serviceEntryId: number

  @column({ columnName: 'service_id' })
  declare serviceId: number

  @column()
  declare quantity: number

  @column({ columnName: 'unit_price' })
  declare unitPrice: number

  @column()
  declare discount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => ServiceEntry)
  declare serviceEntry: BelongsTo<typeof ServiceEntry>

  @belongsTo(() => Service)
  declare service: BelongsTo<typeof Service>
}
