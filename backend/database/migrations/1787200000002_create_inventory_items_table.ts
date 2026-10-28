import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'inventory_items'

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
        .integer('inventory_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('inventories')
        .onDelete('RESTRICT')
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('RESTRICT')

      // Foto do saldo na abertura (null vira 0).
      table.decimal('stock_quantity', 15, 4).notNullable()
      // null = não contado; aceita 0.
      table.decimal('counted_quantity', 15, 4).nullable()
      // Saldo no instante do fechamento, antes do ajuste; null se aberto ou não ajustado.
      table.decimal('stock_at_close', 15, 4).nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['inventory_id', 'product_id'], {
        indexName: 'inventory_items_inventory_product_uq',
      })
      table.index(['product_id'], 'inventory_items_product_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
