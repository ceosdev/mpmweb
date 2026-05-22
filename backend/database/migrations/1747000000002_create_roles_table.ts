import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Roles — the access profile a user holds inside a company
 * (root, admin, operator). System roles cannot be deleted.
 */
export default class extends BaseSchema {
  protected tableName = 'roles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table.string('name', 80).notNullable()
      table.string('slug', 40).notNullable().unique()
      table.string('description', 255).nullable()
      table.boolean('is_system').notNullable().defaultTo(false)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
