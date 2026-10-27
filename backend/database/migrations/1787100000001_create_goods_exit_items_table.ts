import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'goods_exit_items'

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
        .integer('goods_exit_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('goods_exits')
        .onDelete('RESTRICT')
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('RESTRICT')

      table.decimal('requested_quantity', 15, 4).notNullable()
      // Só a saída normal; gravada na finalização, null até lá.
      table.decimal('consumed_quantity', 15, 4).nullable()
      // Foto do custo do produto; regravada na finalização. Null se sem custo.
      table.decimal('unit_cost', 20, 10).nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['goods_exit_id', 'product_id'], {
        indexName: 'goods_exit_items_exit_product_uq',
      })
      table.index(['company_id', 'goods_exit_id'], 'goods_exit_items_company_exit_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
