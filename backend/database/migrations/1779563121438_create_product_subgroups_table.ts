import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Product subgroups — child of `product_groups`. Hard delete.
 * `company_id` is denormalized (also derivable from product_group_id → company_id)
 * to guard against cross-tenant access and simplify scoped queries.
 * Description is not unique within a group — duplicates allowed by design.
 */
export default class extends BaseSchema {
  protected tableName = 'product_subgroups'

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
        .integer('product_group_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('product_groups')
        .onDelete('RESTRICT')

      table.string('description', 120).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(
        ['product_group_id', 'description'],
        'product_subgroups_group_description_idx'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
