import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('quantity_in_stock', 15, 4).nullable().alter()
      table.decimal('minimum_stock', 15, 4).nullable().alter()
      table.decimal('cost_price', 20, 10).nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('quantity_in_stock', 12, 3).nullable().alter()
      table.decimal('minimum_stock', 12, 3).nullable().alter()
      table.decimal('cost_price', 12, 2).nullable().alter()
    })
  }
}
