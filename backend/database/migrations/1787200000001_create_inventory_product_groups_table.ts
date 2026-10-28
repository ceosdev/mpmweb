import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Groups chosen when opening an inventory. No rows means "all groups".
 */
export default class extends BaseSchema {
  protected tableName = 'inventory_product_groups'

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
        .integer('product_group_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('product_groups')
        .onDelete('RESTRICT')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['inventory_id', 'product_group_id'], {
        indexName: 'inventory_product_groups_inventory_group_uq',
      })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
