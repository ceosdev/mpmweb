import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Memberships — the link between a user and a company with a given role.
 * This is where per-company access lives; extra permissions are attached to
 * this row (see `membership_permissions`).
 */
export default class extends BaseSchema {
  protected tableName = 'memberships'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table
        .integer('company_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('companies')
        .onDelete('CASCADE')

      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('roles')
        .onDelete('RESTRICT')

      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.timestamp('deleted_at').nullable()

      table.unique(['user_id', 'company_id'], { indexName: 'memberships_user_company_unique' })
      table.index(['company_id'], 'memberships_company_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
