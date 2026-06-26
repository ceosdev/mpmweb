import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Products per company. Hard delete (no `deleted_at`). No uniqueness on
 * `description` — duplicates are allowed by design, consistent with the
 * cadastros family. All FKs (group, subgroup, unit) are optional and use
 * RESTRICT so a parent in use can't be deleted. Stock fields are governed by
 * `controls_stock`: when false, both `minimum_stock` and `quantity_in_stock`
 * are forced to null at the service layer. `quantity_in_stock` is only set at
 * create time; the update validator omits it (it's fed by the future stock
 * entry module).
 */
export default class extends BaseSchema {
  protected tableName = 'products'

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
      table.string('type', 20).nullable() // 'consumable' | 'fixed_asset'

      table
        .integer('product_group_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('product_groups')
        .onDelete('RESTRICT')

      table
        .integer('product_subgroup_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('product_subgroups')
        .onDelete('RESTRICT')

      table
        .integer('unit_of_measure_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('units_of_measure')
        .onDelete('RESTRICT')

      table.boolean('controls_stock').notNullable().defaultTo(false)
      table.decimal('minimum_stock', 12, 3).nullable()
      table.decimal('quantity_in_stock', 12, 3).nullable()
      table.decimal('cost_price', 12, 2).nullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'description'], 'products_company_description_idx')
      table.index(['company_id', 'product_group_id'], 'products_company_group_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
