import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import ServiceGroup from '#models/service_group'

export type ServiceType = 'internal' | 'third_party'

/**
 * Service — per-company catalog entry. Hard delete: removal is permanent.
 * Belongs to a ServiceGroup (RESTRICT prevents deleting a group still in use).
 * `suggested_value` holds a reference price in reais; the frontend masks it as
 * BRL for display and input.
 */
export default class Service extends BaseModel {
  static table = 'services'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'service_group_id' })
  declare serviceGroupId: number

  @column()
  declare description: string

  @column({
    columnName: 'suggested_value',
    // pg returns numeric/decimal as string — normalize to number for the API.
    consume: (value: string | null) => (value === null ? null : Number(value)),
  })
  declare suggestedValue: number | null

  @column()
  declare type: ServiceType

  @column()
  declare notes: string | null

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => ServiceGroup, { foreignKey: 'serviceGroupId' })
  declare group: BelongsTo<typeof ServiceGroup>
}
