import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Brand models — child of `brands`. Hard delete.
 * `company_id` is denormalized (also derivable from brand_id → company_id)
 * to guard against cross-tenant access and simplify scoped queries.
 * Description is not unique within a brand — duplicates allowed by design.
 */
export default class extends BaseSchema {
  protected tableName = 'brand_models'

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
        .integer('brand_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('brands')
        .onDelete('RESTRICT')

      table.string('description', 120).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['brand_id', 'description'], 'brand_models_brand_description_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
