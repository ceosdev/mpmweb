import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'

/**
 * Employee — per-company catalog entry, the "funcionário" consumer of future
 * goods exits. Hard delete: removal is permanent; FKs from other modules turn
 * a delete of a used employee into a 409 (deactivate instead).
 *
 * `tax_id` (CPF), `zip_code`, `phone` and `mobile` are stored digits-only.
 * `tax_id` is optional and unique per company (partial index). `role_title`
 * is the job title — not `role`, which is the RBAC profile. `is_active` and
 * `terminated_at` are independent on purpose.
 */
export default class Employee extends BaseModel {
  static table = 'employees'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column()
  declare name: string

  @column({ columnName: 'role_title' })
  declare roleTitle: string | null

  @column.date({ columnName: 'birth_date' })
  declare birthDate: DateTime | null

  @column({ columnName: 'tax_id' })
  declare taxId: string | null

  @column({ columnName: 'id_number' })
  declare idNumber: string | null

  @column({ columnName: 'work_card' })
  declare workCard: string | null

  @column()
  declare pis: string | null

  @column({ columnName: 'driver_license' })
  declare driverLicense: string | null

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

  @column.date({ columnName: 'hired_at' })
  declare hiredAt: DateTime | null

  @column.date({ columnName: 'terminated_at' })
  declare terminatedAt: DateTime | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>
}
