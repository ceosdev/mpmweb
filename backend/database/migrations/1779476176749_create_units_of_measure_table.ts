import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Units of measure per company. Hard delete (no `deleted_at`).
 * Description is not unique — duplicates allowed by design.
 */
export default class extends BaseSchema {
  protected tableName = 'units_of_measure'

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

      table.string('description', 120).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'description'], 'units_of_measure_company_description_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
