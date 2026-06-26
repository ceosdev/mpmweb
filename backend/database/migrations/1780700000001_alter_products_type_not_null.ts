import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `type` becomes required (NOT NULL). Safe: the column had no null rows when
 * this ran. Values: 'consumable' | 'fixed_asset'.
 */
export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('type', 20).notNullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('type', 20).nullable().alter()
    })
  }
}
