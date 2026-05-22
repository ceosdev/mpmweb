import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import Permission from '#models/permission'

/**
 * Role — the access profile inside a company (root, admin, operator).
 * The default permissions of a role are bound through `role_permissions`.
 */
export default class Role extends BaseModel {
  static table = 'roles'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column()
  declare isSystem: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @manyToMany(() => Permission, {
    pivotTable: 'role_permissions',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'permission_id',
    pivotTimestamps: { createdAt: 'created_at', updatedAt: false },
  })
  declare permissions: ManyToMany<typeof Permission>
}
