import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * MembershipPermissions — extra permissions granted to a specific membership,
 * on top of the ones inherited from its role. This is how a user can do
 * something their role normally would not allow.
 */
export default class extends BaseSchema {
  protected tableName = 'membership_permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table
        .integer('membership_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('memberships')
        .onDelete('CASCADE')

      table
        .integer('permission_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('permissions')
        .onDelete('CASCADE')

      table.timestamp('created_at').notNullable()

      table.unique(['membership_id', 'permission_id'], {
        indexName: 'membership_permissions_unique',
      })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
