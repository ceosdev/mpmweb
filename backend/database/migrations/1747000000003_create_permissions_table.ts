import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Permissions — the granular catalog of actions the application protects.
 * Slug convention: `<module>.<action>` (e.g. `users.create`).
 */
export default class extends BaseSchema {
  protected tableName = 'permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table.string('name', 120).notNullable()
      table.string('slug', 80).notNullable().unique()
      table.string('module', 60).notNullable()
      table.string('action', 30).notNullable()
      table.string('description', 255).nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['module'], 'permissions_module_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
