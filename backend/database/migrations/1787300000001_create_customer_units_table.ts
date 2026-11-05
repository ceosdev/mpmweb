import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Customer units — child of `customer_regions` (ex.: "Romero Marques" in
 * "Distrito 5"). Hard delete.
 * `company_id` is denormalized; the customer is derived through the region.
 * Description is not unique within a region — duplicates allowed by design.
 */
export default class extends BaseSchema {
  protected tableName = 'customer_units'

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
        .integer('customer_region_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('customer_regions')
        .onDelete('RESTRICT')

      table.string('description', 120).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['customer_region_id', 'description'], 'customer_units_region_description_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
