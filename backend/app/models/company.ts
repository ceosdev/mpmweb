import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Membership from '#models/membership'

/**
 * Company — a tenant of the platform. Soft-deleted: `deletedAt` is set
 * instead of removing the row (see CompanyRepository).
 */
export default class Company extends BaseModel {
  static table = 'companies'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare legalName: string

  @column()
  declare tradeName: string | null

  /** Brazilian company registration number (CNPJ). */
  @column()
  declare taxId: string | null

  @column({ columnName: 'state_registration' })
  declare stateRegistration: string | null

  @column({ columnName: 'municipal_registration' })
  declare municipalRegistration: string | null

  @column()
  declare address: string | null

  @column({ columnName: 'address_number' })
  declare addressNumber: string | null

  @column()
  declare neighborhood: string | null

  @column()
  declare city: string | null

  @column({ columnName: 'zip_code' })
  declare zipCode: string | null

  @column()
  declare state: string | null

  @column()
  declare phone: string | null

  @column()
  declare email: string | null

  /** Relative path of the uploaded logo, served by @adonisjs/drive. */
  @column({ columnName: 'logo_path' })
  declare logoPath: string | null

  @column()
  declare slug: string

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare deletedAt: DateTime | null

  @hasMany(() => Membership)
  declare memberships: HasMany<typeof Membership>
}
