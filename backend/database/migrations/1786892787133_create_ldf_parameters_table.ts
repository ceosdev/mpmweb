import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Parametrizações de LDF (lançamento direto financeiro) per company. Hard
 * delete (no `deleted_at`). Description is not unique — duplicates allowed by
 * design. `expense_group_id` is RESTRICT: an expense group already used by a
 * parameter cannot be deleted.
 */
export default class extends BaseSchema {
  protected tableName = 'ldf_parameters'

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
        .integer('expense_group_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('expense_groups')
        .onDelete('RESTRICT')

      table.string('description', 120).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'description'], 'ldf_parameters_company_description_idx')
      table.index(['company_id', 'expense_group_id'], 'ldf_parameters_company_group_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
