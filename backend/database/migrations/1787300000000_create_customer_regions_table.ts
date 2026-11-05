import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Customer regions — child of `customers` (ex.: "Distrito 5" of a
 * municipal health fund). Hard delete.
 * `company_id` is denormalized (also derivable from customer_id → company_id)
 * to guard against cross-tenant access and simplify scoped queries.
 * Description is not unique within a customer — duplicates allowed by design.
 */
export default class extends BaseSchema {
  protected tableName = 'customer_regions'

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
        .integer('customer_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('customers')
        .onDelete('RESTRICT')

      table.string('description', 120).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['customer_id', 'description'], 'customer_regions_customer_description_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
