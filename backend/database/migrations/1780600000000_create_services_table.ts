import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Services per company. Hard delete (no `deleted_at`). No uniqueness on
 * `description` — duplicates are allowed by design, consistent with the
 * cadastros family. `company_id` is denormalized (also reachable via
 * `service_group_id → company_id`) to defend against cross-tenant access and
 * simplify the listing queries. Both FKs use RESTRICT.
 */
export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table
        .integer('company_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('companies')
        .onDelete('RESTRICT')

      table
        .integer('service_group_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('service_groups')
        .onDelete('RESTRICT')

      table.string('description', 120).notNullable()
      table.decimal('suggested_value', 12, 2).nullable()
      table.string('type', 20).notNullable() // 'internal' | 'third_party'
      table.text('notes').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'description'], 'services_company_description_idx')
      table.index(['company_id', 'service_group_id'], 'services_company_group_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
