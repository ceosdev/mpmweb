import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'

export type SupplierType = 'goods' | 'service'

/**
 * Supplier — per-company catalog entry. Hard delete: removal is permanent.
 * FK to companies prevents the underlying company from being deleted while it
 * still has rows here.
 *
 * `tax_id`, `zip_code`, `phone` and `mobile` are stored digits-only; the
 * frontend masks them for display.
 */
export default class Supplier extends BaseModel {
  static table = 'suppliers'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'tax_id' })
  declare taxId: string

  @column()
  declare name: string

  @column()
  declare type: SupplierType

  @column()
  declare address: string | null

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

  @column({ columnName: 'contact_name' })
  declare contactName: string | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>
}
