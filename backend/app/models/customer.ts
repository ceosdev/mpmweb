import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'

export type CustomerType = 'individual' | 'company'

/**
 * Customer — per-company catalog entry. Hard delete: removal is permanent.
 * FK to companies prevents the underlying company from being deleted while it
 * still has rows here.
 *
 * `tax_id`, `zip_code`, `phone` and `mobile` are stored digits-only; the
 * frontend masks them for display. PF rows use `legal_name` for the full name
 * and leave `trade_name` null; PJ rows use `legal_name` for razão social plus
 * an optional `trade_name` for nome fantasia.
 */
export default class Customer extends BaseModel {
  static table = 'customers'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column()
  declare type: CustomerType

  @column({ columnName: 'legal_name' })
  declare legalName: string

  @column({ columnName: 'trade_name' })
  declare tradeName: string | null

  @column({ columnName: 'tax_id' })
  declare taxId: string

  @column()
  declare address: string | null

  @column({ columnName: 'address_number' })
  declare addressNumber: string | null

  @column({ columnName: 'address_complement' })
  declare addressComplement: string | null

  @column()
  declare neighborhood: string | null

  @column()
  declare city: string | null

  @column({ columnName: 'zip_code' })
  declare zipCode: string | null

  @column()
  declare phone: string | null

  @column()
  declare mobile: string | null

  @column()
  declare email: string | null

  @column.date({ columnName: 'customer_since' })
  declare customerSince: DateTime | null

  @column({ columnName: 'contact_name' })
  declare contactName: string | null

  @column()
  declare isActive: boolean

  @column({ columnName: 'is_internal' })
  declare isInternal: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>
}
