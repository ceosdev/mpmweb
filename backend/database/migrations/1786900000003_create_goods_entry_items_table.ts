import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'goods_entry_items'

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
      // RESTRICT: o service apaga os filhos explicitamente na transação.
      table
        .integer('goods_entry_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('goods_entries')
        .onDelete('RESTRICT')
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('RESTRICT')

      table.decimal('quantity', 15, 4).notNullable()
      table.decimal('unit_price', 20, 10).notNullable()
      table.decimal('discount', 12, 2).notNullable().defaultTo(0)
      // Efeito aplicado na finalização ('stock' | 'none' | 'asset'); null até lá.
      table.string('stock_effect', 10).nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['goods_entry_id', 'product_id'], {
        indexName: 'goods_entry_items_entry_product_uq',
      })
      table.index(['company_id', 'goods_entry_id'], 'goods_entry_items_company_entry_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
