import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Users — platform-level accounts. A user belongs to the platform and is
 * linked to one or many companies through `memberships`.
 * `is_root` grants unrestricted, cross-company access.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table.string('name', 120).notNullable()
      table.string('email', 180).notNullable().unique()
      table.string('password', 255).notNullable()
      table.boolean('is_root').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('last_login_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.timestamp('deleted_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
