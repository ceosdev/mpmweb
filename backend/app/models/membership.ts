import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Company from '#models/company'
import Role from '#models/role'
import Permission from '#models/permission'

/**
 * Membership — the link between a user and a company with a role. This is
 * where per-company access lives; extra permissions granted on top of the
 * role are attached here through `membership_permissions`.
 */
export default class Membership extends BaseModel {
  static table = 'memberships'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare companyId: number

  @column()
  declare roleId: number

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare deletedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>

  /**
   * Extra permissions granted to this membership specifically — added on top
   * of whatever the role already allows.
   */
  @manyToMany(() => Permission, {
    pivotTable: 'membership_permissions',
    pivotForeignKey: 'membership_id',
    pivotRelatedForeignKey: 'permission_id',
    pivotTimestamps: { createdAt: 'created_at', updatedAt: false },
  })
  declare extraPermissions: ManyToMany<typeof Permission>
}
