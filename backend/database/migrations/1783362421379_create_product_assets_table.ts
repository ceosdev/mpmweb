import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Product assets — child of `products`. Hard delete.
 * Only products of type `fixed_asset` may own assets (enforced in the service).
 * `company_id` is denormalized (also derivable from product_id → company_id)
 * to guard against cross-tenant access and simplify scoped queries.
 * `asset_code` is NOT unique — duplicates allowed by design.
 */
export default class extends BaseSchema {
  protected tableName = 'product_assets'

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
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('RESTRICT')

      table.string('description', 160).notNullable()
      table.string('asset_code', 60).nullable()

      table
        .integer('brand_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('brands')
        .onDelete('RESTRICT')

      table
        .integer('brand_model_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('brand_models')
        .onDelete('RESTRICT')

      table.string('manufacture_year', 4).nullable()
      table.string('btu', 20).nullable()
      table.string('situation').notNullable().defaultTo('available')
      table.boolean('equipment_exists').notNullable().defaultTo(false)
      table.text('notes').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['product_id', 'description'], 'product_assets_product_description_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
