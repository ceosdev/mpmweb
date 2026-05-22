import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * RolePermissions — pivot binding the default permissions of a role.
 */
export default class extends BaseSchema {
  protected tableName = 'role_permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('roles')
        .onDelete('CASCADE')

      table
        .integer('permission_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('permissions')
        .onDelete('CASCADE')

      table.timestamp('created_at').notNullable()

      table.unique(['role_id', 'permission_id'], { indexName: 'role_permissions_unique' })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
